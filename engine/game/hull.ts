// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HULL IN THE WATER. The hull is a set of PROBES laid out from the
// spec's length, beam, depth and deadrise: four stations along the keel,
// each a keel point and two chine points, plus two deck points so an
// inverted hull still floats. Each probe owns a share of the hull's volume
// and of its bottom area, and every water force is summed probe by probe
// off the wave surface at that probe — its height AND its orbital
// velocity, so a wave face lifts the bow and its crest carries the hull
// forward. Torques fall out of where the probes sit.
//
// Models, each at the function that implements it: Archimedes for the
// buoyancy; the ITTC-57 friction line for the skin friction; a bluff-body
// form drag for the displacement-mode hump; a lateral plate drag for the
// keel and sponsons with the V bottom's bank-in; a flat-plate heave drag;
// von Kármán's (1929) wedge impact for the slam on re-entry. Savitsky's
// planing lift is `hydro.ts`'s and is DISTRIBUTED here over the wet
// probes. Numbers live in `defs/`, not here.

import { rotate, unrotate, type Quat, type Vec3 } from "../lib/quat.ts";
import { clamp } from "../lib/math.ts";
import type { CraftSpec } from "./defs/craft.ts";
import { TUNING } from "./defs/tuning.ts";
import type { SurfaceSample } from "./water.ts";

const H = TUNING.hull;
const G = TUNING.g;

export type HullProbe = {
  /** Body-frame position, m (x right, y up, z forward, origin at the CoG). */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** The volume this probe owns, m³, and the vertical band it fills over,
   * m — fully submerged once the surface is `height` above it. */
  readonly volume: number;
  readonly height: number;
  /** Bottom area the probe stands for, m², and the plan width and length
   * of that patch, m. */
  readonly area: number;
  readonly width: number;
  readonly length: number;
  readonly kind: "keel" | "chine" | "deck";
  /** −1 port, 0 keel, +1 starboard. */
  readonly side: number;
  readonly station: number;
};

const cache = new Map<string, readonly HullProbe[]>();

/** The probe layout for a spec, built once. */
export function hullProbes(spec: CraftSpec): readonly HullProbe[] {
  const hit = cache.get(spec.id);
  if (hit) return hit;
  const probes: HullProbe[] = [];
  const stations = H.stations;
  const shareSum = H.stationShare.reduce((a, b) => a + b, 0);
  const bottomVolume = spec.displacement * (1 - H.deckShare);
  // Plan area of a V bottom: the rectangle less the bow's taper.
  const bottomArea = spec.length * spec.beam * 0.72;
  const halfBeam = spec.beam / 2;
  const deadrise = (spec.deadrise * Math.PI) / 180;
  const stationLength = spec.length / stations.length;
  for (let i = 0; i < stations.length; i++) {
    const s = stations[i];
    const share = H.stationShare[i] / shareSum;
    const bow = i === stations.length - 1;
    const taper = bow ? H.bowTaper : 1;
    const rise = bow ? H.bowRise * spec.height : 0;
    const z = (s - 0.5) * spec.length - spec.cog.z;
    const keelY = -spec.cog.y + rise;
    const chineOut = H.chineOut * halfBeam * taper;
    const chineY = keelY + chineOut * Math.tan(deadrise);
    const volume = bottomVolume * share;
    const area = bottomArea * share;
    const height = spec.height * 0.72;
    const width = spec.beam * taper;
    const row: [number, number, number, "keel" | "chine", number][] = [
      [0, keelY, volume * H.keelShare, "keel", 0],
      [-chineOut, chineY, (volume * (1 - H.keelShare)) / 2, "chine", -1],
      [chineOut, chineY, (volume * (1 - H.keelShare)) / 2, "chine", 1],
    ];
    for (const [x, y, v, kind, side] of row) {
      const areaShare = kind === "keel" ? H.keelShare : (1 - H.keelShare) / 2;
      probes.push({
        x,
        y,
        z,
        volume: v,
        height,
        area: area * areaShare,
        width: width * areaShare,
        length: stationLength,
        kind,
        side,
        station: i,
      });
    }
  }
  // The deck: two probes at the sheer, fore and aft, owning the volume
  // above the chines. They fill over the top third of the hull.
  const deckY = spec.height - spec.cog.y;
  for (const zf of [-0.3, 0.3]) {
    probes.push({
      x: 0,
      y: deckY,
      z: zf * spec.length - spec.cog.z,
      volume: (spec.displacement * H.deckShare) / 2,
      height: spec.height * 0.3,
      area: bottomArea / 6,
      width: spec.beam * 0.6,
      length: stationLength,
      kind: "deck",
      side: 0,
      station: -1,
    });
  }
  cache.set(spec.id, probes);
  return probes;
}

/** The total mass the water carries, kg — hull plus rider. */
export function totalMass(spec: CraftSpec): number {
  return spec.mass + spec.riderMass;
}

/** Body-frame inertia tensor diagonal, kg·m², for the hull as a box of its
 * own dimensions with the rider's mass sat `riderHeight` up: pitch (x),
 * yaw (y), roll (z). */
export function inertia(spec: CraftSpec): Vec3 {
  const m = spec.mass;
  const r = spec.riderMass;
  const L2 = spec.length * spec.length;
  const B2 = spec.beam * spec.beam;
  const H2 = spec.height * spec.height;
  const rh2 = spec.riderHeight * spec.riderHeight;
  return {
    x: (m / 12) * (L2 + H2) + r * rh2,
    y: (m / 12) * (L2 + B2),
    z: (m / 12) * (B2 + H2) + r * rh2,
  };
}

/** Submerged volume of the probes, m³, with the hull level at CoG height
 * `y` above a still surface. */
function stillVolume(probes: readonly HullProbe[], y: number): number {
  let v = 0;
  for (const p of probes) v += p.volume * clamp((0 - (y + p.y)) / p.height, 0, 1);
  return v;
}

/** The height of the CoG above a still surface at rest, level, m —
 * where Archimedes puts it: submerged volume × density = mass. Bisected,
 * because the probes fill in bands. The buoyancy test holds the settled
 * craft to this. */
export function restY(spec: CraftSpec, density: number): number {
  const probes = hullProbes(spec);
  const need = totalMass(spec) / density;
  let lo = -spec.height;
  let hi = spec.height;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (stillVolume(probes, mid) > need) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Skin friction coefficient, ITTC-57 model-ship correlation line:
 * C_F = 0.075 / (log₁₀ Re − 2)², Re = V·L/ν. Floored at Re = 10⁵ where the
 * line turns over. */
export function frictionCoefficient(speed: number, length: number): number {
  const re = Math.max((Math.abs(speed) * length) / TUNING.water.viscosity, 1e5);
  const d = Math.log10(re) - 2;
  return 0.075 / (d * d);
}

/** What one step of the water did to the hull, summed: force and torque
 * in the WORLD frame, plus the readings the state keeps. */
export type HullResult = {
  fx: number;
  fy: number;
  fz: number;
  tx: number;
  ty: number;
  tz: number;
  /** Area-weighted share of the bottom probes under the surface, 0..1. */
  wetted: number;
  /** Deepest probe below the surface, m (0 when dry). */
  submerged: number;
  /** Keel depth at the transom and the bow stations, m below the surface
   * (negative when clear) — what the wetted length is read from. */
  transomDepth: number;
  bowDepth: number;
  /** Whether the transom-station keel is wet enough to feed the pump. */
  intakeWet: boolean;
  /** Mean of the wet probes' relative flow, body frame, m/s — the speed
   * through the water the planing lift and the pump read. */
  flowFwd: number;
  flowUp: number;
  /** Mean surface normal under the wet probes, world frame. */
  nx: number;
  ny: number;
  nz: number;
  /** Fastest descent into the water among the entering probes, m/s. */
  entryVy: number;
  /** The wet bottom's lateral centre, body x in m, weighted by immersion —
   * where the planing lift stands, so a rolled hull is lifted on its
   * deeper chine and rights. */
  liftX: number;
};

export type ProbeSample = {
  /** World position and velocity of the probe this step. */
  px: number;
  py: number;
  pz: number;
  vx: number;
  vy: number;
  vz: number;
  /** The surface there. */
  surface: SurfaceSample;
  /** How far under the surface, m, and the fill fraction 0..1. */
  depth: number;
  fill: number;
};

/** Allocate the per-probe scratch once per craft. */
export function probeSamples(count: number): ProbeSample[] {
  const out: ProbeSample[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      px: 0,
      py: 0,
      pz: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      surface: { height: 0, nx: 0, ny: 1, nz: 0, vx: 0, vy: 0, vz: 0 },
      depth: 0,
      fill: 0,
    });
  }
  return out;
}

/** Where each probe is and how fast it moves, world frame, off the body's
 * pose and rates: v_p = v + R(ω × p). The surface is sampled by the
 * caller, since only it knows the sea. */
export function placeProbes(
  probes: readonly HullProbe[],
  samples: ProbeSample[],
  q: Quat,
  x: number,
  y: number,
  z: number,
  vx: number,
  vy: number,
  vz: number,
  wx: number,
  wy: number,
  wz: number,
): void {
  for (let i = 0; i < probes.length; i++) {
    const p = probes[i];
    const s = samples[i];
    const r = rotate(q, { x: p.x, y: p.y, z: p.z });
    const spin = rotate(q, {
      x: wy * p.z - wz * p.y,
      y: wz * p.x - wx * p.z,
      z: wx * p.y - wy * p.x,
    });
    s.px = x + r.x;
    s.py = y + r.y;
    s.pz = z + r.z;
    s.vx = vx + spin.x;
    s.vy = vy + spin.y;
    s.vz = vz + spin.z;
  }
}

/** Accumulate a world-frame force at a world-frame offset from the CoG. */
function apply(
  out: HullResult,
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

/** Sum the water's forces over the probes. `samples` must already carry
 * the probe poses and their surface samples; `planingShare` (0..1, the
 * planing lift's share of the weight last step) fades the
 * displacement-mode form drag out as the hull climbs onto the plane. The
 * planing lift itself is the craft step's to apply (`hydro.ts`), at the
 * lateral centre this reports. */
export function hullForces(
  spec: CraftSpec,
  probes: readonly HullProbe[],
  samples: ProbeSample[],
  q: Quat,
  x: number,
  y: number,
  z: number,
  density: number,
  planingShare: number,
  out: HullResult,
): void {
  out.fx = out.fy = out.fz = out.tx = out.ty = out.tz = 0;
  out.wetted = 0;
  out.submerged = 0;
  out.transomDepth = -1;
  out.bowDepth = -1;
  out.intakeWet = false;
  out.flowFwd = 0;
  out.flowUp = 0;
  out.nx = out.nz = 0;
  out.ny = 0;
  out.entryVy = 0;
  out.liftX = 0;
  const right = rotate(q, { x: 1, y: 0, z: 0 });
  const up = rotate(q, { x: 0, y: 1, z: 0 });
  const fwd = rotate(q, { x: 0, y: 0, z: 1 });
  const deadrise = (spec.deadrise * Math.PI) / 180;
  const cotDeadrise = 1 / Math.tan(Math.max(deadrise, 0.05));
  const tanDeadrise = Math.tan(deadrise);
  const mass = totalMass(spec);
  let bottomArea = 0;
  let wetArea = 0;
  let liftWeight = 0;
  let liftX = 0;
  let flowCount = 0;
  let slamTotal = 0;
  const slamCap = H.slamCapG * mass * G;
  // The slam is summed apart so the cap can scale it alone.
  let sfx = 0;
  let sfy = 0;
  let sfz = 0;
  let stx = 0;
  let sty = 0;
  let stz = 0;

  // First pass: depths, fills, the readings, and the lift weights.
  for (let i = 0; i < probes.length; i++) {
    const p = probes[i];
    const s = samples[i];
    s.depth = s.surface.height - s.py;
    s.fill = clamp(s.depth / p.height, 0, 1);
    if (p.kind !== "deck") {
      bottomArea += p.area;
      if (s.depth > 0) wetArea += p.area * Math.min(1, s.depth / (p.height * 0.35));
      if (p.kind === "keel" && p.station === 0) out.transomDepth = s.depth;
      if (p.kind === "keel" && p.station === H.stations.length - 1) out.bowDepth = s.depth;
      if (s.depth > 0) {
        const w = p.area * Math.min(s.depth, p.height);
        liftWeight += w;
        liftX += w * p.x;
      }
    }
    if (s.depth > out.submerged) out.submerged = s.depth;
  }
  out.wetted = bottomArea > 0 ? wetArea / bottomArea : 0;
  out.liftX = liftWeight > 0 ? liftX / liftWeight : 0;
  out.intakeWet = out.transomDepth > -TUNING.pump.intakeDepth;

  for (let i = 0; i < probes.length; i++) {
    const p = probes[i];
    const s = samples[i];
    const rx = s.px - x;
    const ry = s.py - y;
    const rz = s.pz - z;
    // Relative flow: the probe through the water that is itself moving.
    const relX = s.vx - s.surface.vx;
    const relY = s.vy - s.surface.vy;
    const relZ = s.vz - s.surface.vz;
    // Slamming happens as the probe ENTERS: descending into water it has
    // not yet filled. von Kármán (1929): the added mass of the entering
    // wedge grows with the wetted half-width c = V·t·cot β, and the force
    // per unit length is ρ·π·c·V²·cot β — an average pressure over the wet
    // strip of ½·ρ·V²·(π·cot β). Applied over the probe's patch for the
    // part of it still to be wetted (1 − fill), then the whole hull's slam
    // is capped (`slamCapG`) because the pile-up Wagner (1932) doubles c
    // by is a pressure real hulls spread and real riders' knees absorb.
    if (s.depth > -0.02 && s.fill < 1 && relY < 0 && p.kind !== "deck") {
      const slam = 0.5 * density * relY * relY * Math.PI * cotDeadrise * H.slamShare;
      const force = slam * p.area * (1 - s.fill);
      slamTotal += force;
      if (-relY > out.entryVy) out.entryVy = -relY;
      // Along the hull's up: a wedge entering nose-down pushes the bow
      // back up, which is the pitch-up a flat landing recovers by and the
      // pitch-DOWN a buried bow does not get (its probes are already full).
      const fx = up.x * force;
      const fy = up.y * force;
      const fz = up.z * force;
      sfx += fx;
      sfy += fy;
      sfz += fz;
      stx += ry * fz - rz * fy;
      sty += rz * fx - rx * fz;
      stz += rx * fy - ry * fx;
    }
    if (s.fill <= 0) continue;

    // Archimedes: F = ρ·g·V_submerged, straight up.
    const buoy = density * G * p.volume * s.fill;
    apply(out, rx, ry, rz, 0, buoy, 0);

    // Body-frame relative flow at this probe.
    const uFwd = relX * fwd.x + relY * fwd.y + relZ * fwd.z;
    const uRight = relX * right.x + relY * right.y + relZ * right.z;
    const uUp = relX * up.x + relY * up.y + relZ * up.z;
    if (p.kind !== "deck") {
      out.flowFwd += uFwd;
      out.flowUp += uUp;
      out.nx += s.surface.nx;
      out.ny += s.surface.ny;
      out.nz += s.surface.nz;
      flowCount += 1;
    }

    // Longitudinal: skin friction over the wetted patch (ITTC-57), both
    // faces of the V counted in the plan area already.
    const cf = frictionCoefficient(uFwd, spec.length);
    let fFwd = -0.5 * density * cf * p.area * s.fill * Math.abs(uFwd) * uFwd;
    // ...and the displacement-mode form drag of the section the hull
    // pushes ahead of itself: the frontal area is the probe's width times
    // its immersion. Present only until the hull is on the plane — past
    // the hump the bottom is a lifting surface and Savitsky's induced drag
    // (the lift's tilt) is the whole of the pressure drag.
    const frontal = p.width * Math.min(s.depth, p.height);
    fFwd -= 0.5 * density * H.formCd * frontal * Math.abs(uFwd) * uFwd * (1 - planingShare);
    // Lateral: the keel and the sponsons as a plate against the sideways
    // flow — the force that makes the hull carve.
    const lateralArea = p.length * Math.min(s.depth, p.height);
    const fRight = -0.5 * density * spec.lateralCd * lateralArea * Math.abs(uRight) * uRight;
    // Heave: the bottom as a plate moving normal to itself.
    const fUp = -0.5 * density * H.heaveCd * p.area * s.fill * Math.abs(uUp) * uUp;
    // The V bottom's BANK-IN: the sideways flow meets the panel on the side
    // the hull slides toward, and that panel's normal has an upward part
    // of tan(deadrise) per unit of lateral. Lifting the outer chine rolls
    // the hull INTO the turn, which is what a PWC does and a keel-level
    // lateral force alone would do the opposite of.
    let bank = 0;
    if (p.kind === "chine" && p.side === Math.sign(uRight)) {
      bank = Math.abs(fRight) * tanDeadrise * H.chineBank;
    }
    const upTotal = fUp + bank;
    apply(
      out,
      rx,
      ry,
      rz,
      fwd.x * fFwd + right.x * fRight + up.x * upTotal,
      fwd.y * fFwd + right.y * fRight + up.y * upTotal,
      fwd.z * fFwd + right.z * fRight + up.z * upTotal,
    );
  }
  if (flowCount > 0) {
    out.flowFwd /= flowCount;
    out.flowUp /= flowCount;
    const nl = Math.hypot(out.nx, out.ny, out.nz) || 1;
    out.nx /= nl;
    out.ny /= nl;
    out.nz /= nl;
  } else {
    out.ny = 1;
  }
  // The slam cap: scale the whole hull's slam back, force and torque
  // alike, when the sum passes what the rider can take.
  const scale = slamTotal > slamCap ? slamCap / slamTotal : 1;
  out.fx += sfx * scale;
  out.fy += sfy * scale;
  out.fz += sfz * scale;
  out.tx += stx * scale;
  out.ty += sty * scale;
  out.tz += stz * scale;
}

/** The body-frame relative flow at the CoG, for callers without probes. */
export function bodyFlow(q: Quat, vx: number, vy: number, vz: number): Vec3 {
  return unrotate(q, { x: vx, y: vy, z: vz });
}
