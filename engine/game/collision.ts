// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// CONTACT WITH WHAT IS NOT WATER: the ground under the shallows, the rocks
// standing in the water, the ramps (an air gate's, and a tricks run's own
// field of them), and the edge of the level. Three models:
//
// - GROUND and RAMPS are penalty contacts on the hull probes: a probe under
//   the surface is pushed back along the surface's normal by a spring and
//   a damper (`TUNING.contact.stiffness`, `.damping`), with Coulomb
//   friction against the tangential slide. The ground's normal is the
//   heightfield's gradient; a ramp is a WEDGE hinged at the water at its
//   rear edge, rising `angle` toward its front, with a submerged approach
//   lip half its length behind the hinge so a hull slides onto it rather
//   than hitting a step — and with walls under the deck on its two flanks
//   and under its lip, so a hull arriving from any side but the hinge's
//   is stopped by a wall rather than thrown by a deck over its head.
// - SOLIDS (skerries, boulders, reefs) are WHALEBACKS: full width where the
//   sea has undercut them, sheer at the waterline, rounding over toward a
//   crown `solidCrown` of that width — the shape the ice left and the shape
//   the renderer carves. They are resolved in two places, and that split is
//   what lets a hull get up ONTO one. WHICH of the two a rock gives you is
//   read off how far the keel is under its crown, against `solidWallBelow`
//   — a band narrower than any hull's draft on the plane, so a rock that
//   BREAKS THE SURFACE is a wall and a rock awash is a road. Their FLANK is the WALL: an impulse
//   at the hull's own keel probes, pushed out along the radial — never with
//   any lift in it — the closing speed reversed by the restitution and most
//   of the slide kept, with the offset from the centre of gravity turning
//   some of it into yaw. Their CROWN is the ROAD: a penalty contact on the
//   hull probes, beside the ground and the ramps, on the stone's own
//   rounded surface, so a hull whose bottom is within `solidRideBelow` of
//   it is carried across rather than stopped — a rock awash shoved under
//   the bottom, a reef grazed, a skerry a jump landed on. A reef whose top
//   the keel clears is not a contact at all.
// - THE BOUNDS push softly back inside: an acceleration growing with the
//   overshoot, so the edge of the world is a slope and never a wall.

import { fieldGradient, sampleField } from "../lib/heightfield.ts";
import { rotate, unrotate } from "../lib/quat.ts";
import { clamp } from "../lib/math.ts";
import type { Level, Ramp, Solid } from "../mapgen/types.ts";
import type { CraftSpec } from "./defs/craft.ts";
import { TUNING } from "./defs/tuning.ts";
import type { HullProbe, ProbeSample } from "./hull.ts";
import { hullProbes, inertia } from "./hull.ts";
import { bedAt } from "./ocean.ts";
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
  /** The ramp whose deck the hull is riding, when it is riding one — so
   * that the arcade's hand on the deck (`assist.ts`, `rampAssist`) reads
   * the ramp this step actually found instead of searching for it again.
   * A hull over two decks at once is not a thing the generator builds. */
  ramp: Ramp | null;
  /** ...and whether any probe is over a deck's FOOTPRINT at all, touching
   * it or not. A hull crossing a ramp lifts clear of the deck and drops
   * back onto it on the way up, which `onRamp` reads as two rides and the
   * flight bookkeeping reads as two jumps — so anything that must not fire
   * until the hull is off the ramp for good (`craft.ts`'s pump) asks this
   * rather than either of them. */
  overRamp: boolean;
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
  cap = Infinity,
): number {
  const vn = s.vx * nx + s.vy * ny + s.vz * nz;
  const normal = Math.min(cap, Math.max(0, C.stiffness * pen - C.damping * vn));
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

/** A ROCK'S OWN SHAPE, stated once, as the radius it has at a height —
 * `Solid.r` at and below the waterline, drawing in to `contact.solidCrown`
 * of it at `top` on `contact.solidTaper`. Below the water the collider
 * keeps the full radius: the flare down there is wider than the plan circle
 * and no hull reaches under its own waterline. */
export function solidRadiusAt(solid: Solid, y: number): number {
  if (y <= 0 || solid.top <= 0) return solid.r;
  const up = Math.min(1, y / solid.top);
  return solid.r * (1 - (1 - C.solidCrown) * up ** C.solidTaper);
}

/** ...and the same shape read the other way round: the height of the stone
 * at a plan point, m against the still-water plane, or −Infinity outside
 * its footprint. This is the rock as a SURFACE — the thing a hull rides
 * over and stands on — and it is what the probes meet, exactly as they meet
 * the sea bed's heightfield.
 *
 * The taper is what makes it a rock rather than a table: the stone stands
 * all but sheer where the sea has undercut it and flattens toward its
 * crown, so a hull driving at the rim meets a wall while one already up
 * over it is carried across. Reading a FLAT lid at `top` instead puts a
 * hull half a metre inside the stone on the step it arrives, and a penalty
 * spring handed half a metre of penetration in one step is a catapult.
 *
 * A rock whose crown is under water — a reef — has no above-water shape to
 * round over, so it is the flat ledge its `top` says it is. */
export function solidSurfaceAt(solid: Solid, x: number, z: number): number {
  const d = Math.hypot(x - solid.x, z - solid.z);
  if (d >= solid.r) return -Infinity;
  if (solid.top <= 0) return solid.top;
  const inset = (1 - d / solid.r) / (1 - C.solidCrown);
  return inset >= 1 ? solid.top : solid.top * inset ** (1 / C.solidTaper);
}

/** Steep enough to count as a wall: forty metres down for one metre out. */
const SHEER = 40;

/** How steeply that surface falls away at a plan distance `d` from the
 * axis: metres of height lost per metre out, the derivative of the profile
 * above. It runs to infinity at the rim — the undercut face is vertical, so
 * the normal there is the plain radial the flank pushes along — and
 * flattens to nothing over the crown. Clamped, because a normal is all that
 * is wanted from it and a vertical one is a vertical one. */
function solidFall(solid: Solid, d: number): number {
  // A rock whose crown is under water is the flat ledge above, so its
  // surface pushes straight up wherever a keel meets it.
  if (solid.top <= 0) return 0;
  const inset = (1 - d / solid.r) / (1 - C.solidCrown);
  if (inset >= 1) return 0;
  if (inset <= 0) return SHEER;
  const p = C.solidTaper;
  return Math.min(SHEER, (solid.top * inset ** (1 / p - 1)) / (p * solid.r * (1 - C.solidCrown)));
}

/** The furthest any probe stands from the centre of gravity, m, whatever
 * the hull's attitude — the cull radius that keeps the rocks from being
 * walked probe by probe. Constant for a layout, so it is measured once. */
const REACH = new WeakMap<readonly HullProbe[], number>();

function probeReach(probes: readonly HullProbe[]): number {
  const held = REACH.get(probes);
  if (held !== undefined) return held;
  let reach = 0;
  for (const p of probes) reach = Math.max(reach, Math.hypot(p.x, p.y, p.z));
  REACH.set(probes, reach);
  return reach;
}

/** Just the keel line out of a hull's probes, sifted once: the flank
 * contact asks for it every step, and a fresh array a step is garbage at
 * 120 Hz. */
const KEEL = new WeakMap<readonly HullProbe[], readonly HullProbe[]>();

function keelProbes(spec: CraftSpec): readonly HullProbe[] {
  const probes = hullProbes(spec);
  const held = KEEL.get(probes);
  if (held) return held;
  const keel = probes.filter((p) => p.kind === "keel");
  KEEL.set(probes, keel);
  return keel;
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

/** EVERY RAMP ON A LEVEL, in course order then field order — stated once,
 * here, because there are two places a deck comes from and nothing else
 * should have to know that. R8's stand before an air gate and throw the
 * hull through its ring; R35's TRICK FIELD (`Level.ramps`) stands on its own
 * down a tricks level's line with no ring over it. A hull cannot tell them
 * apart and neither can this function.
 *
 * Cached per level rather than rebuilt: a level is read-only from the
 * moment it compiles, and this is asked once per physics step — 120 times a
 * second, for as long as the run lasts. */
const RAMPS = new WeakMap<Level, readonly Ramp[]>();

export function rampsOf(level: Level): readonly Ramp[] {
  const held = RAMPS.get(level);
  if (held) return held;
  const ramps: Ramp[] = [];
  for (const gate of level.course.gates) if (gate.ramp) ramps.push(gate.ramp);
  for (const ramp of level.ramps) ramps.push(ramp);
  RAMPS.set(level, ramps);
  return ramps;
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
  out.ramp = null;
  out.overRamp = false;
  out.groundSpeed = 0;
  const ramps = rampsOf(level);
  for (let i = 0; i < probes.length; i++) {
    const s = samples[i];
    // The ground — `bedAt`, not the field, so that a level's last row of
    // cells is not repeated out to sea as a plateau of land a rider out in
    // the storm can run aground on (`ocean.ts`).
    const g = bedAt(level, s.px, s.pz);
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
    // The ramps. A probe a little under the deck is riding it — including
    // the graze that climbs aboard near the hinge, where the deck stands
    // centimetres up. A probe FURTHER under it than `rampWallBelow` did
    // not sink through the deck: it came in through whichever wall of the
    // wedge is the shallowest way back out — one of the two flanks, or
    // the end wall under the lip — and is pushed out through that one. A
    // hull arriving from the side or from downrange meets a wall, not a
    // deck two metres over its head; a deep probe far from every wall is
    // a hull slammed onto the MIDDLE of the deck, and the deck pushes
    // back. There is no rear wall — behind the hinge the deck runs down
    // under the water as the approach lip, which a hull rides onto.
    for (const ramp of ramps) {
      const at = onRampDeck(ramp, s.px, s.pz);
      if (!at) continue;
      out.overRamp = true;
      const deck = rampDeckY(ramp, at.along);
      if (s.py >= deck) continue;
      const sh = Math.sin(ramp.heading);
      const ch = Math.cos(ramp.heading);
      const ca = Math.cos(ramp.angle);
      // How far back out of the wedge each face is, m.
      const pen = (deck - s.py) * ca;
      const flank = ramp.width / 2 - Math.abs(at.across);
      const lip = ramp.length - at.along;
      const wall = Math.min(flank, lip);
      if (pen > C.rampWallBelow && wall < pen) {
        // Out through the wall, by its overlap, with the ground's
        // friction — horizontally, and never setting `onRamp`.
        const side = at.across >= 0 ? 1 : -1;
        const nx = flank <= lip ? side * ch : sh;
        const nz = flank <= lip ? -side * sh : ch;
        penalty(out, s, cx, cy, cz, nx, 0, nz, wall, C.groundFriction);
        continue;
      }
      const sa = Math.sin(ramp.angle);
      const nx = -sa * sh;
      const ny = ca;
      const nz = -sa * ch;
      if (penalty(out, s, cx, cy, cz, nx, ny, nz, pen, C.rampFriction, C.rampDeckCap) > 0) {
        out.onRamp = true;
        out.ramp = ramp;
      }
    }
  }
  // THE ROCKS' CROWNS. A probe inside the stone and within
  // `solidRideBelow` of its top is ON the rock rather than in it — the
  // shallowest way back out is straight up — so the crown carries it, with
  // the friction of a bottom dragged over stone. That is a hull that flew
  // onto a skerry, a rock awash shoved under the bottom, a reef scraped
  // over: all of them the hull RIDING the rock, which is why this reports
  // through `onGround` and earns a `ground` rather than a `hit`.
  //
  // A probe deeper than the band is in the FLANK, and the flank is
  // `clipSolids`'s: a penalty spring can be punched through in one step at
  // 30 m/s, and a rock is the one thing a hull may not pass.
  const rocks = level.solids;
  if (rocks.length > 0) {
    const reach = probeReach(probes);
    for (const solid of rocks) {
      if (Math.hypot(solid.x - cx, solid.z - cz) > solid.r + reach) continue;
      for (let i = 0; i < probes.length; i++) {
        const s = samples[i];
        const stone = solidSurfaceAt(solid, s.px, s.pz);
        const under = stone - s.py;
        if (under <= 0 || under > C.solidRideBelow) continue;
        const d = Math.hypot(s.px - solid.x, s.pz - solid.z);
        const fall = solidFall(solid, d);
        const nl = Math.hypot(fall, 1);
        const rx = d > 1e-6 ? (s.px - solid.x) / d : 1;
        const rz = d > 1e-6 ? (s.pz - solid.z) / d : 0;
        const nx = (rx * fall) / nl;
        const ny = 1 / nl;
        const nz = (rz * fall) / nl;
        const pen = under * ny;
        if (penalty(out, s, cx, cy, cz, nx, ny, nz, pen, C.groundFriction, C.solidTopCap) > 0) {
          out.onGround = true;
          const closing = -(s.vx * nx + s.vy * ny + s.vz * nz);
          if (closing > out.groundSpeed) out.groundSpeed = closing;
        }
      }
    }
  }
}

/** Resolve the hull against the FLANKS of the level's solids: push out,
 * reflect, and report. Mutates position and velocity directly, the way an
 * impulse does, and pushes the events. The crowns are `contactForces`'s. */
export function clipSolids(
  level: Level,
  spec: CraftSpec,
  craft: CraftState,
  t: number,
  events: GameEvent[],
): void {
  const radius = (spec.beam / 2) * C.hullRadius;
  // THE KEEL LINE IS THE HULL'S OWN, rocker and all — the keel probes the
  // buoyancy is read at, taken where they stand in the body rather than as
  // a level line through the centre of gravity. A planing hull's forefoot
  // sits a good half-metre above its transom (`TUNING.hull.stationRise`)
  // and it is lifted further by the trim, and both are exactly the
  // difference between clearing a rock awash and striking it.
  const keel = keelProbes(spec);
  const reach = probeReach(keel);
  const I = inertia(spec);
  const mass = spec.mass + spec.riderMass;
  for (const solid of level.solids) {
    if (Math.hypot(solid.x - craft.x, solid.z - craft.z) > solid.r + radius + reach) continue;
    for (const probe of keel) {
      const at = rotate(craft.q, { x: 0, y: probe.y, z: probe.z });
      const px = craft.x + at.x;
      const py = craft.y + at.y;
      const pz = craft.z + at.z;
      // Over the crown: the keel either clears the rock outright, or is
      // near enough the top that it is RIDING it — held up by the crown
      // in `contactForces` — rather than buried in the flank.
      //
      // The band is `solidWallBelow` and NOT the crown's own reach: that
      // one is sized for a landing caught from above, and a keel is only
      // ever 0.16–0.25 m under the surface on the plane, so spending the
      // crown's band here exempts every rock standing less than half a
      // metre out of the water from the wall — rock that is not a step a
      // planing bow mounts but a wall buried in the bottom of the hull.
      if (py > solid.top - C.solidWallBelow) continue;
      const dx = px - solid.x;
      const dz = pz - solid.z;
      const dist = Math.hypot(dx, dz);
      const bite = solidRadiusAt(solid, py) + radius;
      if (dist >= bite) continue;
      const rx = dist > 1e-6 ? dx / dist : 1;
      const rz = dist > 1e-6 ? dz / dist : 0;
      // THE FLANK PUSHES SIDEWAYS AND ONLY SIDEWAYS. The stone does lean
      // back as it rounds over, and it is tempting to push out along that
      // leaning normal — but the radius the reach is read from moves with
      // the height, so a hull lifted by its own push finds less rock under
      // it, drops back into more, and is pumped up off a low rock at ten
      // metres a second by a contact that is supposed to stop it. Every
      // way UP a rock is the crown's (`contactForces`); this is the wall.
      const overlap = bite - dist;
      craft.x += rx * overlap;
      craft.z += rz * overlap;
      const closing = Math.max(0, -(craft.vx * rx + craft.vz * rz));
      // Impulse: kill the closing speed, give back the restitution, keep
      // most of the slide — a glancing pass that only scrapes loses a
      // little of its way and none of its heading.
      const jn = closing * (1 + C.restitution);
      const tx = craft.vx + closing * rx;
      const tz = craft.vz + closing * rz;
      craft.vx = rx * (closing * C.restitution) + tx * C.tangentKeep;
      craft.vz = rz * (closing * C.restitution) + tz * C.tangentKeep;
      // The contact's offset from the CoG turns the impulse into yaw.
      const rb = unrotate(craft.q, { x: at.x, y: 0, z: at.z });
      const jb = unrotate(craft.q, { x: rx * jn * mass, y: 0, z: rz * jn * mass });
      craft.wy += (rb.z * jb.x - rb.x * jb.z) / I.y;
      if (Math.max(closing, craft.speed) >= C.hitSpeed && craft.hitCooldown <= 0) {
        events.push({ kind: "hit", t, solid: solid.id, speed: closing });
        craft.hitCooldown = C.hitCooldown;
      }
      break;
    }
  }
}

/** Whether the rim the push would act from stands in OPEN WATER. The basin
 * pads every side but the sea's with land (R14, R15), so a rim deeper than
 * `contact.boundsOpenDepth` is the open ocean and a rider is let through to
 * it; a rim with land at it, or a creek's last shallow metres (R26), turns
 * him back. */
function rimIsOpen(level: Level, x: number, z: number): boolean {
  return -sampleField(level.ground, x, z) >= C.boundsOpenDepth;
}

/** The bounds' soft push, as a world-frame acceleration, m/s².
 *
 * THE SEA HAS NO FAR SIDE. The push is the edge of the BUILT world, and it
 * holds a rider inside it only where that edge is land: where the grid's rim
 * stands in the open sea he rides straight out of the level and on into the
 * storm, with the sea, the bed and the wind going with him (`ocean.ts`).
 *
 * Each axis's spring also asks that the rider still be WITHIN the box along
 * the other one, so that a rider a kilometre out at sea is not reeled
 * sideways by the land rim he is now abeam of. Nothing is lost by it: the
 * land past a rim is the rim's own height carried on (the heightfield clamps
 * to its edge), so the ground itself is what stops a hull from riding over
 * the country, and this spring is only the backstop on the water. */
export function boundsPush(level: Level, x: number, z: number): { ax: number; az: number } {
  const b = level.bounds;
  const m = C.boundsMargin;
  const alongX = x >= b.minX && x <= b.maxX;
  const alongZ = z >= b.minZ && z <= b.maxZ;
  let ax = 0;
  let az = 0;
  if (alongZ) {
    if (x < b.minX + m && !rimIsOpen(level, b.minX, z)) ax = (b.minX + m - x) * C.boundsSpring;
    else if (x > b.maxX - m && !rimIsOpen(level, b.maxX, z)) ax = (b.maxX - m - x) * C.boundsSpring;
  }
  if (alongX) {
    if (z < b.minZ + m && !rimIsOpen(level, x, b.minZ)) az = (b.minZ + m - z) * C.boundsSpring;
    else if (z > b.maxZ - m && !rimIsOpen(level, x, b.maxZ)) az = (b.maxZ - m - z) * C.boundsSpring;
  }
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
