// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R1, R4–R11 — THE COURSE SEARCH: the path along the shore, the gates on
// it, the straights the ramps need, and the keep-out that hands the placer
// its answer. Deterministic in the rng it is given; returns null — never a
// violation — when the coast it was given cannot carry a legal course, and
// the generator rerolls the sub-seed.
//
// How the line is found. The shore is a function u = offset(s) of distance
// along its base line (shore.ts), so the path is drawn the same way: a
// STATION every `course.station` metres of s, each holding an offset OUT
// from the shore's own offset. The aim is a slow wander inside `course.aim`
// from the seeded noise; then every station is pushed seaward, a step at a
// time, until the water under it is deep enough (R5, with the search's own
// slack over the rule) and it is inside R1's band, the line is smoothed so
// the pushes are swells rather than kinks, and the pushing repeats until
// nothing moves. A station that cannot be made legal inside the band — a
// bay whose shelf never gets deep enough — fails the whole attempt.
//
// The gates are then measured out along the path by distance (R4, R11),
// and two or three of them are lifted into the air (R7): for each, the
// stretch of path from the start of its run-up to the end of its landing
// is replaced by the CHORD between its ends (R9's straight), after the
// chord has been checked for depth and for the band, because a chord
// across a bay cuts the shore closer than the curve did. Windows are laid
// in course order with the distances recomputed each time, so a chord is
// exactly the stretch of path the gate's distances name.
//
// THE RAMP'S ANCHOR — stated once, here, for everything that reads a
// `Ramp`: (x, z) is the HINGE, the centre of the rear edge, floating at the
// waterline. The deck runs `length` metres along `heading` from it, rising
// at `angle`, so its plan footprint is `length · cos(angle)` long and its
// front edge stands `length · sin(angle)` above the sea. `rampSurface` is
// the one function that turns that into a height.

import { clamp } from "../lib/math.ts";
import { valueNoise } from "../lib/noise.ts";
import type { Rng } from "../lib/prng.ts";
import type { Geology } from "./geology.ts";
import { LEVEL_RULES as R, inBand } from "./rules.ts";
import type { Shore } from "./shore.ts";
import type { Gate, Ramp, Vec2 } from "./types.ts";

export type CoursePlan = {
  readonly gates: Gate[];
  readonly path: Vec2[];
  readonly length: number;
  readonly start: { x: number; z: number; heading: number };
};

/** Height of a ramp's deck above the sea at a plan point, m — or null
 * where the point is not over the deck. The hinge convention lives here. */
export function rampSurface(ramp: Ramp, x: number, z: number): number | null {
  const fx = Math.sin(ramp.heading);
  const fz = Math.cos(ramp.heading);
  const px = x - ramp.x;
  const pz = z - ramp.z;
  const along = px * fx + pz * fz;
  const across = px * fz - pz * fx;
  const footprint = ramp.length * Math.cos(ramp.angle);
  if (along < 0 || along > footprint || Math.abs(across) > ramp.width / 2) return null;
  return along * Math.tan(ramp.angle);
}

/** The straight corridor an air gate owns, from the start of its run-up to
 * the end of its landing, and the half-width a solid must keep out of:
 * the deck's half plus R6's margin. */
export function airCorridor(gate: Gate): {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  halfWidth: number;
} {
  const ramp = gate.ramp;
  if (!ramp) throw new Error(`gate ${gate.id} is an air gate with no ramp`);
  const fx = Math.sin(ramp.heading);
  const fz = Math.cos(ramp.heading);
  return {
    x0: ramp.x - fx * R.ramp.runUp,
    z0: ramp.z - fz * R.ramp.runUp,
    x1: gate.x + fx * R.air.landing,
    z1: gate.z + fz * R.air.landing,
    halfWidth: ramp.width / 2 + R.course.solidMargin,
  };
}

/** The two buoys of a water gate (an air gate has none). */
export function gateBuoys(gate: Gate): Vec2[] {
  if (gate.kind !== "water") return [];
  const rx = Math.cos(gate.heading);
  const rz = -Math.sin(gate.heading);
  const half = gate.width / 2;
  return [
    { x: gate.x + rx * half, z: gate.z + rz * half },
    { x: gate.x - rx * half, z: gate.z - rz * half },
  ];
}

/** Distance from a plan point to a segment. */
export function segmentDistance(
  x: number,
  z: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  const t = len2 > 0 ? clamp(((x - ax) * dx + (z - az) * dz) / len2, 0, 1) : 0;
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}

/** Distance from a plan point to a polyline. */
export function polylineDistance(points: readonly Vec2[], x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    const d = segmentDistance(x, z, a.x, a.z, b.x, b.z);
    if (d < best) best = d;
  }
  return best;
}

/** Cumulative distance to each vertex of a polyline, m. */
export function cumulative(points: readonly Vec2[]): Float64Array {
  const out = new Float64Array(points.length);
  for (let i = 1; i < points.length; i++) {
    out[i] = out[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
  }
  return out;
}

/** The point `d` metres along a polyline and the heading of the segment it
 * falls on; clamped to the ends. */
export function pointAlong(
  points: readonly Vec2[],
  cum: Float64Array,
  d: number,
): { x: number; z: number; heading: number; index: number } {
  const last = points.length - 1;
  let i = 0;
  while (i < last - 1 && cum[i + 1] < d) i++;
  const a = points[i];
  const b = points[Math.min(i + 1, last)];
  const span = cum[Math.min(i + 1, last)] - cum[i];
  const t = span > 0 ? clamp((d - cum[i]) / span, 0, 1) : 0;
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
    heading: Math.atan2(b.x - a.x, b.z - a.z),
    index: i,
  };
}

/** Visit a point every `step` metres along a polyline, including both
 * ends; stops early when `visit` returns false. Returns whether it ran to
 * the end. */
export function walkPolyline(
  points: readonly Vec2[],
  step: number,
  visit: (x: number, z: number, d: number) => boolean | void,
): boolean {
  const cum = cumulative(points);
  const total = cum[cum.length - 1];
  for (let d = 0; ; d += step) {
    const at = d >= total ? total : d;
    const p = pointAlong(points, cum, at);
    if (visit(p.x, p.z, at) === false) return false;
    if (at >= total) return true;
  }
}

/** Replace the stretch of a polyline between two distances with the chord
 * between its ends, returning the new polyline. */
function straighten(points: Vec2[], from: number, to: number): Vec2[] {
  const cum = cumulative(points);
  const a = pointAlong(points, cum, from);
  const b = pointAlong(points, cum, to);
  const out: Vec2[] = [];
  for (let i = 0; i < points.length; i++) if (cum[i] < from) out.push(points[i]);
  out.push({ x: a.x, z: a.z });
  out.push({ x: b.x, z: b.z });
  for (let i = 0; i < points.length; i++) if (cum[i] > to) out.push(points[i]);
  return out;
}

/** Sample a chord every 2 m and ask `legal` of each point. */
function chordLegal(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  legal: (x: number, z: number, d: number) => boolean,
): boolean {
  const len = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.ceil(len / 2));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (!legal(ax + (bx - ax) * t, az + (bz - az) * t, len * t)) return false;
  }
  return true;
}

/** Lay a course along a shore, or return null when this coast cannot carry
 * one under the rules. */
export function layCourse(rng: Rng, shore: Shore, geology: Geology): CoursePlan | null {
  const S = R.search;
  const band = {
    min: R.course.offshore.min + S.offshoreSlack,
    max: R.course.offshore.max - S.offshoreSlack,
  };
  const needDepth = R.course.minDepth + S.depthSlack;
  const runUpDepth = R.ramp.runUpDepth + S.depthSlack;

  const target = inBand(rng, R.course.target);
  const aimSeed = rng.int(1, 0x7fffffff);
  const airCount = rng.int(R.air.count.min, R.air.count.max);

  // ── The stations ────────────────────────────────────────────────────
  const stationCount =
    Math.ceil((R.course.length.max + R.start.behind + R.course.station) / R.course.station) + 1;
  const offs = new Float64Array(stationCount);
  for (let i = 0; i < stationCount; i++) {
    const s = i * R.course.station;
    offs[i] =
      R.course.aim.min +
      (R.course.aim.max - R.course.aim.min) * valueNoise(s, 0, R.course.aimScale, aimSeed);
  }
  const legalAt = (x: number, z: number, depth: number): boolean => {
    const { ground, offshore } = geology.sample(x, z);
    return offshore >= band.min && offshore <= band.max && ground <= -depth;
  };
  const stationLegal = (i: number, off: number): boolean => {
    const s = i * R.course.station;
    const p = shore.toWorld(s, shore.offsetAt(s) + off);
    return legalAt(p.x, p.z, needDepth);
  };
  // Push seaward until legal; the scan is bounded by the aim band plus
  // the pushes it could take to reach R1's edge, so a shelf that never
  // gets deep enough is found out rather than searched for ever.
  const push = (i: number): boolean => {
    const ceiling = R.course.offshore.max;
    let off = offs[i];
    while (off <= ceiling) {
      if (stationLegal(i, off)) {
        if (off !== offs[i]) {
          offs[i] = off;
          return true;
        }
        return false;
      }
      off += S.push.step;
    }
    // Nothing seaward works: the shore may be sloping such that the true
    // distance runs past the band; try pulling in.
    off = offs[i] - S.push.step;
    while (off >= R.course.offshore.min) {
      if (stationLegal(i, off)) {
        offs[i] = off;
        return true;
      }
      off -= S.push.step;
    }
    return false;
  };
  for (let iter = 0; iter < 6; iter++) {
    let moved = false;
    for (let i = 0; i < stationCount; i++) {
      if (!stationLegal(i, offs[i])) {
        if (!push(i)) return null;
        moved = true;
      }
    }
    if (!moved) break;
    // A pushed station is a swell, not a step: the [1, 2, 1] smoothing
    // spreads each push over its neighbours, and the next pass re-pushes
    // whatever the smoothing lowered below legal.
    const prev = Float64Array.from(offs);
    for (let i = 1; i + 1 < stationCount; i++) {
      offs[i] = Math.max(prev[i], (prev[i - 1] + 2 * prev[i] + prev[i + 1]) / 4);
    }
  }
  for (let i = 0; i < stationCount; i++) if (!stationLegal(i, offs[i]) && !push(i)) return null;

  let points: Vec2[] = [];
  for (let i = 0; i < stationCount; i++) {
    const s = i * R.course.station;
    points.push(shore.toWorld(s, shore.offsetAt(s) + offs[i]));
  }

  // ── The start straight (R11) ────────────────────────────────────────
  const startStraight = R.start.behind + R.course.station;
  {
    const a = points[0];
    const b = pointAlong(points, cumulative(points), startStraight);
    if (!chordLegal(a.x, a.z, b.x, b.z, (x, z) => legalAt(x, z, needDepth))) return null;
    points = straighten(points, 0, startStraight);
  }

  // ── The gates by distance (R4, R10) ─────────────────────────────────
  const gateD: number[] = [R.start.behind];
  for (;;) {
    const next = gateD[gateD.length - 1] + inBand(rng, R.gate.spacing);
    if (next > target) break;
    gateD.push(next);
  }
  const finishD = gateD[gateD.length - 1];
  if (finishD < R.course.length.min || finishD > R.course.length.max) return null;

  // ── The air gates (R7, R8, R9) ──────────────────────────────────────
  type AirDraw = { index: number; lead: number; length: number; angle: number; height: number };
  const candidates: number[] = [];
  for (let i = 1; i + 1 < gateD.length; i++) candidates.push(i);
  // A seeded shuffle, so which gates fly is the seed's choice and the
  // first legal ones in that order are taken.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const t = candidates[i];
    candidates[i] = candidates[j];
    candidates[j] = t;
  }
  const chosen: AirDraw[] = [];
  const windowOf = (draw: AirDraw): { from: number; to: number } => ({
    from: gateD[draw.index] - draw.lead - R.ramp.runUp,
    to: gateD[draw.index] + R.air.landing,
  });
  const chordOk = (draw: AirDraw, pts: Vec2[]): boolean => {
    const cum = cumulative(pts);
    const w = windowOf(draw);
    const a = pointAlong(pts, cum, w.from);
    const b = pointAlong(pts, cum, w.to);
    // The run-up and the deck want R9's depth; the landing wants R5's.
    const ringD = gateD[draw.index] - w.from;
    return chordLegal(a.x, a.z, b.x, b.z, (x, z, d) =>
      legalAt(x, z, d <= ringD ? runUpDepth : needDepth),
    );
  };
  for (const index of candidates) {
    if (chosen.length >= airCount) break;
    const draw: AirDraw = {
      index,
      lead: inBand(rng, R.ramp.lead),
      length: inBand(rng, R.ramp.length),
      angle: inBand(rng, R.ramp.angle),
      height: inBand(rng, R.air.height),
    };
    const w = windowOf(draw);
    if (w.from < startStraight || w.to > finishD) continue;
    if (chosen.some((c) => windowOf(c).from < w.to && w.from < windowOf(c).to)) continue;
    if (!chordOk(draw, points)) continue;
    chosen.push(draw);
  }
  if (chosen.length < R.air.count.min) return null;
  chosen.sort((a, b) => a.index - b.index);
  for (const draw of chosen) {
    // Re-verified on the path as it stands now — upstream chords shorten
    // the line a little, and the window is a promise about distances.
    if (!chordOk(draw, points)) return null;
    const w = windowOf(draw);
    points = straighten(points, w.from, w.to);
  }

  // ── The finished geometry ───────────────────────────────────────────
  const cum = cumulative(points);
  const finish = pointAlong(points, cum, finishD);
  const path: Vec2[] = [];
  for (let i = 0; i <= finish.index; i++) path.push(points[i]);
  path.push({ x: finish.x, z: finish.z });
  const pathCum = cumulative(path);

  const gates: Gate[] = gateD.map((d, i) => {
    const at = pointAlong(path, pathCum, d);
    const air = chosen.find((c) => c.index === i);
    if (!air) {
      return {
        id: `G${i + 1}`,
        index: i,
        kind: "water",
        x: at.x,
        y: 0,
        z: at.z,
        heading: at.heading,
        width: R.gate.width,
      };
    }
    const hinge = pointAlong(path, pathCum, d - air.lead);
    const ramp: Ramp = {
      id: `J${i + 1}`,
      x: hinge.x,
      z: hinge.z,
      heading: at.heading,
      length: air.length,
      width: R.ramp.width,
      angle: air.angle,
    };
    return {
      id: `G${i + 1}`,
      index: i,
      kind: "air",
      x: at.x,
      y: air.height,
      z: at.z,
      heading: at.heading,
      width: R.air.width,
      ramp,
    };
  });

  const first = gates[0];
  return {
    gates,
    path,
    length: pathCum[pathCum.length - 1],
    start: { x: path[0].x, z: path[0].z, heading: first.heading },
  };
}

/** R6, R9 — the placer's question: may a rock of radius `r` stand here?
 * Kept `search.marginSlack` clear beyond the rule, so the finished level
 * holds the rule with room. */
export function courseKeepOut(plan: CoursePlan): (x: number, z: number, r: number) => boolean {
  const margin = R.course.solidMargin + R.search.marginSlack;
  const buoys = plan.gates.flatMap(gateBuoys);
  const corridors = plan.gates.filter((g) => g.kind === "air").map(airCorridor);
  return (x, z, r) => {
    if (polylineDistance(plan.path, x, z) < r + margin) return false;
    for (const b of buoys) if (Math.hypot(b.x - x, b.z - z) < r + margin) return false;
    for (const c of corridors) {
      if (segmentDistance(x, z, c.x0, c.z0, c.x1, c.z1) < r + c.halfWidth + R.search.marginSlack) {
        return false;
      }
    }
    return true;
  };
}
