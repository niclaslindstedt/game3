// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// CONTACT WITH WHAT IS NOT WATER: the ground under the shallows, the rocks
// standing in the water, the ramps before the air gates, and the edge of
// the level. Three models:
//
// - GROUND and RAMPS are penalty contacts on the hull probes: a probe under
//   the surface is pushed back along the surface's normal by a spring and
//   a damper (`TUNING.contact.stiffness`, `.damping`), with Coulomb
//   friction against the tangential slide. The ground's normal is the
//   heightfield's gradient; a ramp is a plane hinged at the water at its
//   rear edge, rising `angle` toward its front, with a submerged approach
//   lip half its length behind the hinge so a hull slides onto it rather
//   than hitting a step.
// - SOLIDS (skerries, boulders, reefs) are vertical cylinders resolved as
//   an impulse at the hull's plan outline: the hull is pushed out along
//   the radial, the closing speed is reversed by the restitution and the
//   sliding speed is kept, and the offset of the contact from the centre
//   of gravity turns some of the impulse into yaw. A reef whose top the
//   keel clears is not a contact.
// - THE BOUNDS push softly back inside: an acceleration growing with the
//   overshoot, so the edge of the world is a slope and never a wall.

import { fieldGradient, sampleField } from "../lib/heightfield.ts";
import { rotate, unrotate } from "../lib/quat.ts";
import { clamp } from "../lib/math.ts";
import type { Level, Ramp, Solid } from "../mapgen/types.ts";
import type { CraftSpec } from "./defs/craft.ts";
import { TUNING } from "./defs/tuning.ts";
import type { HullProbe, ProbeSample } from "./hull.ts";
import { inertia } from "./hull.ts";
import type { CraftState, GameEvent } from "./state.ts";

const C = TUNING.contact;

export type ContactResult = {
  fx: number;
  fy: number;
  fz: number;
  tx: number;
  ty: number;
  tz: number;
  onGround: boolean;
  onRamp: boolean;
  /** Fastest closing speed into the ground this step, m/s. */
  groundSpeed: number;
};

function push(
  out: ContactResult,
  rx: number,
  ry: number,
  rz: number,
  fx: number,
  fy: number,
  fz: number,
): void {
  out.fx += fx;
  out.fy += fy;
  out.fz += fz;
  out.tx += ry * fz - rz * fy;
  out.ty += rz * fx - rx * fz;
  out.tz += rx * fy - ry * fx;
}

/** A penalty contact at a probe: `pen` metres into a surface with unit
 * normal n, the probe moving at v. Returns the normal force, N. */
function penalty(
  out: ContactResult,
  s: ProbeSample,
  cx: number,
  cy: number,
  cz: number,
  nx: number,
  ny: number,
  nz: number,
  pen: number,
  friction: number,
): number {
  const vn = s.vx * nx + s.vy * ny + s.vz * nz;
  const normal = Math.max(0, C.stiffness * pen - C.damping * vn);
  if (normal <= 0) return 0;
  // Tangential slide, damped toward rest over the last 0.3 m/s so a
  // resting hull does not chatter.
  const tx = s.vx - vn * nx;
  const ty = s.vy - vn * ny;
  const tz = s.vz - vn * nz;
  const ts = Math.hypot(tx, ty, tz);
  const f = (friction * normal) / (ts + 0.3);
  push(
    out,
    s.px - cx,
    s.py - cy,
    s.pz - cz,
    normal * nx - f * tx,
    normal * ny - f * ty,
    normal * nz - f * tz,
  );
  return normal;
}

/** The ramp's deck height, m, at a point `along` metres up it from the
 * hinge — the plane continues below the water behind the hinge as the
 * approach lip. */
export function rampDeckY(ramp: Ramp, along: number): number {
  return along * Math.tan(ramp.angle);
}

/** Where a plan point sits on a ramp: metres up it from the hinge and
 * across it from the centreline, or null when it is off the deck (the lip
 * behind the hinge counts as on it). */
export function onRampDeck(
  ramp: Ramp,
  x: number,
  z: number,
): { along: number; across: number } | null {
  const dx = x - ramp.x;
  const dz = z - ramp.z;
  const sh = Math.sin(ramp.heading);
  const ch = Math.cos(ramp.heading);
  const along = dx * sh + dz * ch;
  const across = dx * ch - dz * sh;
  if (along < -ramp.length * 0.5 || along > ramp.length) return null;
  if (Math.abs(across) > ramp.width / 2) return null;
  return { along, across };
}

/** Ground and ramp contacts over the probes, summed into `out`. */
export function contactForces(
  level: Level,
  probes: readonly HullProbe[],
  samples: ProbeSample[],
  cx: number,
  cy: number,
  cz: number,
  out: ContactResult,
): void {
  out.fx = out.fy = out.fz = out.tx = out.ty = out.tz = 0;
  out.onGround = false;
  out.onRamp = false;
  out.groundSpeed = 0;
  const ramps: Ramp[] = [];
  for (const gate of level.course.gates) if (gate.ramp) ramps.push(gate.ramp);
  for (let i = 0; i < probes.length; i++) {
    const s = samples[i];
    // The ground.
    const g = sampleField(level.ground, s.px, s.pz);
    if (s.py < g) {
      const { gx, gz } = fieldGradient(level.ground, s.px, s.pz);
      const nl = Math.hypot(gx, 1, gz);
      const nx = -gx / nl;
      const ny = 1 / nl;
      const nz = -gz / nl;
      const pen = (g - s.py) * ny;
      const n = penalty(out, s, cx, cy, cz, nx, ny, nz, pen, C.groundFriction);
      if (n > 0) {
        out.onGround = true;
        const closing = -(s.vx * nx + s.vy * ny + s.vz * nz);
        if (closing > out.groundSpeed) out.groundSpeed = closing;
      }
    }
    // The ramps. A probe a little under the deck is riding it; a probe
    // far under it came in through the ramp's FLANK — a hull arriving
    // from the side meets a wall, not a deck two metres over its head —
    // and is pushed back out across the deck's width instead.
    for (const ramp of ramps) {
      const at = onRampDeck(ramp, s.px, s.pz);
      if (!at) continue;
      const deck = rampDeckY(ramp, at.along);
      if (s.py >= deck) continue;
      const sa = Math.sin(ramp.angle);
      const ca = Math.cos(ramp.angle);
      const pen = (deck - s.py) * ca;
      if (pen > C.rampFlankBelow) {
        const side = at.across >= 0 ? 1 : -1;
        const nx = side * Math.cos(ramp.heading);
        const nz = -side * Math.sin(ramp.heading);
        const overlap = ramp.width / 2 - Math.abs(at.across);
        penalty(out, s, cx, cy, cz, nx, 0, nz, overlap, C.groundFriction);
        continue;
      }
      const nx = -sa * Math.sin(ramp.heading);
      const ny = ca;
      const nz = -sa * Math.cos(ramp.heading);
      if (penalty(out, s, cx, cy, cz, nx, ny, nz, pen, C.rampFriction) > 0) out.onRamp = true;
    }
  }
}

/** Resolve the hull against the level's solids: push out, reflect, and
 * report. Mutates position and velocity directly, the way an impulse
 * does; returns the hits for the events. */
export function clipSolids(
  level: Level,
  spec: CraftSpec,
  craft: CraftState,
  t: number,
  events: GameEvent[],
): void {
  const radius = (spec.beam / 2) * C.hullRadius;
  const fwd = rotate(craft.q, { x: 0, y: 0, z: 1 });
  // Three points along the keel line: stern, middle, bow.
  const keelY = -spec.cog.y;
  const half = spec.length / 2;
  const I = inertia(spec);
  const mass = spec.mass + spec.riderMass;
  for (const solid of level.solids) {
    for (const along of [-half * 0.8, 0, half * 0.8]) {
      const px = craft.x + fwd.x * along;
      const py = craft.y + keelY;
      const pz = craft.z + fwd.z * along;
      // Over a reef: the keel clears the top.
      if (py > solid.top) continue;
      const dx = px - solid.x;
      const dz = pz - solid.z;
      const dist = Math.hypot(dx, dz);
      const reach = solid.r + radius;
      if (dist >= reach) continue;
      const nx = dist > 1e-6 ? dx / dist : 1;
      const nz = dist > 1e-6 ? dz / dist : 0;
      const overlap = reach - dist;
      craft.x += nx * overlap;
      craft.z += nz * overlap;
      const closing = Math.max(0, -(craft.vx * nx + craft.vz * nz));
      // Impulse: kill the closing speed, give back the restitution, keep
      // most of the slide — a glancing pass that only scrapes loses a
      // little of its way and none of its heading.
      const jn = closing * (1 + C.restitution);
      const tx = craft.vx + closing * nx;
      const tz = craft.vz + closing * nz;
      craft.vx = nx * (closing * C.restitution) + tx * C.tangentKeep;
      craft.vz = nz * (closing * C.restitution) + tz * C.tangentKeep;
      // The contact's offset from the CoG turns the impulse into yaw.
      const rb = unrotate(craft.q, { x: fwd.x * along, y: 0, z: fwd.z * along });
      const jb = unrotate(craft.q, { x: nx * jn * mass, y: 0, z: nz * jn * mass });
      craft.wy += (rb.z * jb.x - rb.x * jb.z) / I.y;
      if (Math.max(closing, craft.speed) >= C.hitSpeed && craft.hitCooldown <= 0) {
        events.push({ kind: "hit", t, solid: solid.id, speed: closing });
        craft.hitCooldown = C.hitCooldown;
      }
      break;
    }
  }
}

/** The bounds' soft push, as a world-frame acceleration, m/s². */
export function boundsPush(level: Level, x: number, z: number): { ax: number; az: number } {
  const b = level.bounds;
  const m = C.boundsMargin;
  let ax = 0;
  let az = 0;
  if (x < b.minX + m) ax = (b.minX + m - x) * C.boundsSpring;
  else if (x > b.maxX - m) ax = (b.maxX - m - x) * C.boundsSpring;
  if (z < b.minZ + m) az = (b.minZ + m - z) * C.boundsSpring;
  else if (z > b.maxZ - m) az = (b.maxZ - m - z) * C.boundsSpring;
  return { ax: clamp(ax, -40, 40), az: clamp(az, -40, 40) };
}

/** Whether a solid stands within `margin` metres of a plan point, for the
 * bot's look-ahead. */
export function solidNear(level: Level, x: number, z: number, margin: number): Solid | null {
  for (const s of level.solids) {
    if (Math.hypot(s.x - x, s.z - z) < s.r + margin) return s;
  }
  return null;
}
