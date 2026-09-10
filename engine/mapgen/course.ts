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
// waterline. The deck runs `length` metres ALONG THE WATER from it in the
// direction `heading` — `length` is the plan footprint — rising at `angle`,
// so the lip stands `length · tan(angle)` above the sea. `rampSurface` is
// the one function here that turns that into a height, and the collision
// engine's `rampDeckY` is the same line.
//
// THE RING'S PLACE (R18) is derived, not drawn: `ringPlacement` puts it on
// the ballistic arc a hull draws off the lip at the design lip speed, so
// the slowest craft in the catalog threads it at a pace it can hold.

import { CRAFT } from "../game/defs/craft.ts";
import { TUNING } from "../game/defs/tuning.ts";
import { angleDiff, clamp } from "../lib/math.ts";
import type { Rng } from "../lib/prng.ts";
import { LEVEL_RULES as R, inBand, solidBerth } from "./rules.ts";
import type { Route } from "./route.ts";
import type { Gate, Ramp, Vec2, Wind } from "./types.ts";

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
  if (along < 0 || along > ramp.length || Math.abs(across) > ramp.width / 2) return null;
  return along * Math.tan(ramp.angle);
}

/** The height of a ballistic arc `d` metres past its launch point, m:
 * launched at `v` m/s and `angle` rad from `y0`, under the engine's g. */
export function arcHeight(y0: number, v: number, angle: number, d: number): number {
  const cos = Math.cos(angle);
  return y0 + d * Math.tan(angle) - (TUNING.g * d * d) / (2 * v * v * cos * cos);
}

/** R18 — where the ring goes for a ramp of `length` (plan, m) and `angle`
 * (rad): the hinge-to-ring distance and the ring's height, and the spread
 * between the slow and the fast design arcs at that distance.
 *
 * The lip is `length · tan(angle)` up; a hull's centre of gravity rides
 * `cog.y` above the deck. The SLOW arc is the lowest-riding hull in the
 * catalog at the band's floor, the FAST arc the highest-riding at the
 * ceiling; the ring's centre sits at their mean, `pastApex` apex-distances
 * past the lip along the slow arc. Read by the search, the analysis and
 * the tests alike, so the three can never disagree about where a ring
 * belongs. */
export function ringPlacement(
  length: number,
  angle: number,
): { lead: number; y: number; spread: number } {
  const lip = length * Math.tan(angle);
  let cogLow = Infinity;
  let cogHigh = -Infinity;
  for (const spec of CRAFT) {
    cogLow = Math.min(cogLow, spec.cog.y);
    cogHigh = Math.max(cogHigh, spec.cog.y);
  }
  const slow = R.air.lipSpeed.min;
  const fast = R.air.lipSpeed.max;
  const apex = (slow * slow * Math.sin(angle) * Math.cos(angle)) / TUNING.g;
  const d = apex * R.air.pastApex;
  const ySlow = arcHeight(lip + cogLow, slow, angle, d);
  const yFast = arcHeight(lip + cogHigh, fast, angle, d);
  return { lead: length + d, y: (ySlow + yFast) / 2, spread: yFast - ySlow };
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
/** What the course search asks about a plan point: how far it is from the
 * water's edge and how deep the water is. Read off the fields the basin and
 * the compiler have already baked — the search no longer has an analytic
 * shore to interrogate, and does not need one. */
export type Water = {
  offshoreAt(x: number, z: number): number;
  depthAt(x: number, z: number): number;
};

/**
 * R1, R4–R11 — the course, laid ON the route.
 *
 * The route (R24) is already the racing line: it was drawn first, and the
 * water was carved around it wide enough that every metre of it stands
 * inside R1's band over water deep enough for R5. So there is no search for
 * a line here any more — the station-push loop that used to hunt one along
 * a coast is gone with the coast's base line. What is left is what the
 * course is: gates measured out along the line by distance, two or three of
 * them lifted into the air with their windows cut straight, and the start
 * put behind the first.
 *
 * The chords are still CHECKED rather than trusted. A straight cut across a
 * bend of the route leaves the corridor that was drawn around the bend, so
 * it can cross an island or a headland the line went round; a window whose
 * chord does not hold water is a window this course cannot have.
 */
export function layCourse(rng: Rng, route: Route, water: Water, wind: Wind): CoursePlan | null {
  const S = R.search;
  const band = {
    min: R.course.offshore.min + S.offshoreSlack,
    max: R.course.offshore.max,
  };
  const needDepth = R.course.minDepth + S.depthSlack;
  const runUpDepth = R.ramp.runUpDepth + S.depthSlack;

  // The finish is aimed inside R10's band, and then held to the line that
  // actually exists: straightening an air gate's window shortens the path,
  // and a target past the end of it puts every gate after it on the same
  // clamped point. What is left has to still be a course.
  const drawn = inBand(rng, R.course.target);
  // R25 — the finish is past the ocean leg, always. A course that stops
  // half way round the mark is a course whose last gate is out at sea and
  // whose rider is left to work out that the race is over; the leg is part
  // of the race or it is not drawn at all.
  const target = Math.min(
    Math.max(drawn, route.leg.to + R.gate.spacing.min),
    route.length - R.course.station * 4,
  );
  if (target < R.course.length.min) return null;
  const airCount = rng.int(R.air.count.min, R.air.count.max);

  // R25 — the mark, and the two things it does to what "legal" means. The
  // ceiling on how far out the line may stand is lifted inside the leg's
  // own zone, because that is the rule the leg is drawn to instead; and the
  // rock itself is the one solid that exists before the course does, so R6
  // is held against it here rather than by the placer afterwards.
  const mark = route.leg.mark;
  const markBerth = mark.r + solidBerth(mark.r) + S.marginSlack;
  const legalAt = (x: number, z: number, depth: number): boolean => {
    const offshore = water.offshoreAt(x, z);
    if (offshore < band.min) return false;
    const toMark = Math.hypot(x - mark.x, z - mark.z);
    if (toMark < markBerth) return false;
    if (offshore > band.max && toMark > mark.zone) return false;
    return water.depthAt(x, z) >= depth;
  };
  let points: Vec2[] = route.points.map((p) => ({ x: p.x, z: p.z }));
  // The line the route drew is the line the course rides, so it has to hold
  // the rules it was drawn to hold. It usually does by construction; where
  // the corridor was pinched by an island the basin cut into it, the whole
  // route is refused and the next sub-seed drawn.
  for (const p of points) if (!legalAt(p.x, p.z, needDepth)) return null;

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
  // R18 — the ring's place follows from the ramp; a ramp whose two design
  // arcs spread wider than the ring can take is no ramp to build.
  const drawAir = (index: number): AirDraw | null => {
    const length = inBand(rng, R.ramp.length);
    const angle = inBand(rng, R.ramp.angle);
    const ring = ringPlacement(length, angle);
    if (ring.spread / 2 + R.air.thread > R.air.width / 2) return null;
    return { index, lead: ring.lead, length, angle, height: ring.y };
  };
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
  /**
   * The stretch of path actually cut straight for a corridor: the window,
   * with its FAR end pushed out until the chord is at least as long as the
   * corridor is.
   *
   * A chord is shorter than the arc it replaces. Straightening exactly the
   * window leaves a straight run shorter than the corridor that has to sit
   * in it, so the landing — and, once the compression is a few metres, the
   * run-up too — starts in the bend beyond the straight's end. On a gently
   * curved coast that is centimetres and invisible; on one with inlets in
   * it (R15) it is several metres over a 135 m window.
   *
   * Only the far end moves. The near end is where the run-up begins, and
   * the run-up is measured back from the hinge, so pushing it out would
   * spend straight water nobody rides.
   */
  const straightSpan = (draw: AirDraw, pts: Vec2[]): { from: number; to: number } => {
    const w = windowOf(draw);
    const cum = cumulative(pts);
    const need = w.to - w.from;
    const a = pointAlong(pts, cum, w.from);
    let to = w.to;
    // Extending the far end by the shortfall only closes the part of it
    // the bend does not eat again, so the step overshoots and the walk
    // runs until it has actually converged rather than a fixed few times.
    // Where the bend is sharp enough that it never does, `chordOk` refuses
    // the candidate outright.
    for (let pass = 0; pass < 10; pass++) {
      const b = pointAlong(pts, cum, to);
      const short = need - Math.hypot(b.x - a.x, b.z - a.z);
      if (short <= 0.05) break;
      to += short * 1.6 + 0.2;
    }
    return { from: w.from, to };
  };
  // R9 — the run-up crosses the sea. The waves travel the way the wind
  // blows TO, and the run-up runs the way the path does at the ring; the
  // angle between them has to be a right angle give or take `ramp.beam`.
  //
  // Measured on the CHORD the window is about to become, not on the line
  // as it stands. Straightening replaces the whole window with that chord,
  // so the heading the rider actually rides the run-up on is the chord's —
  // and reading the curve's own heading at the hinge is how a jump comes
  // out of the search beam-on and out of the analysis forty degrees off
  // it, which was the commonest reason a basin was thrown away.
  const waveHeading = wind.from + Math.PI;
  const acrossTheSea = (draw: AirDraw, pts: Vec2[]): boolean => {
    const cum = cumulative(pts);
    const w = straightSpan(draw, pts);
    const a = pointAlong(pts, cum, w.from);
    const b = pointAlong(pts, cum, w.to);
    const heading = Math.atan2(b.x - a.x, b.z - a.z);
    const off = Math.abs(angleDiff(waveHeading, heading));
    return Math.abs(off - Math.PI / 2) <= R.ramp.beam;
  };
  const chordOk = (draw: AirDraw, pts: Vec2[]): boolean => {
    const cum = cumulative(pts);
    const w = straightSpan(draw, pts);
    const a = pointAlong(pts, cum, w.from);
    const b = pointAlong(pts, cum, w.to);
    // The straight this leaves has to be at least as long as the corridor
    // that sits in it: a bend too sharp for the span to widen its way out
    // of is a place with no room for a jump, not a jump to be squeezed in.
    if (Math.hypot(b.x - a.x, b.z - a.z) < windowOf(draw).to - w.from - 0.05) return false;
    // The run-up and the deck want R9's depth; the landing wants R5's.
    const ringD = gateD[draw.index] - w.from;
    return chordLegal(a.x, a.z, b.x, b.z, (x, z, d) =>
      legalAt(x, z, d <= ringD ? runUpDepth : needDepth),
    );
  };
  for (const index of candidates) {
    if (chosen.length >= airCount) break;
    const draw = drawAir(index);
    if (!draw) continue;
    const w = straightSpan(draw, points);
    if (w.from < startStraight || w.to > finishD) continue;
    if (chosen.some((c) => windowOf(c).from < w.to && w.from < windowOf(c).to)) continue;
    if (!acrossTheSea(draw, points)) continue;
    if (!chordOk(draw, points)) continue;
    chosen.push(draw);
  }
  if (chosen.length < R.air.count.min) return null;
  chosen.sort((a, b) => a.index - b.index);
  for (const draw of chosen) {
    // Re-verified on the path as it stands now — upstream chords shorten
    // the line a little, and the window is a promise about distances. The
    // BEAM too (R9): straightening one window moves every window after it,
    // and a jump that was across the sea when it was chosen and is not now
    // is a rejection the analysis would otherwise make a whole build
    // later.
    if (!chordOk(draw, points)) return null;
    if (!acrossTheSea(draw, points)) return null;
    const w = straightSpan(draw, points);
    points = straighten(points, w.from, w.to);
  }

  // ── The finished geometry ───────────────────────────────────────────
  const cum = cumulative(points);
  // Every chord straightened above SHORTENS the line, and the gates were
  // measured out on the line before it was shortened. A finish past the end
  // of what is left clamps to the last point — and so does every gate after
  // it, which is how a course comes out with two gates in the same place.
  if (finishD > cum[cum.length - 1]) return null;
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
  const buoys = plan.gates.flatMap(gateBuoys);
  const corridors = plan.gates.filter((g) => g.kind === "air").map(airCorridor);
  return (x, z, r) => {
    const margin = solidBerth(r) + R.search.marginSlack;
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
