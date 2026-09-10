// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R29, R31 — THE OCEAN CIRCUIT'S LINE: a CLOSED lap, drawn out at sea.
//
// R24's route is a walk with two ends. A circuit has none: it is a loop the
// rider goes round and round, and the only honest way to draw one is as a
// closed curve rather than as a walk that is asked to find its way home —
// a walk steered back to its start arrives at whatever heading it arrives
// at, and the join is a kink no rider can take at speed.
//
// So the shape is POLAR. A mean radius, warped by a handful of harmonics of
// the angle round it:
//
//     r(θ) = 1 + Σ aₖ · sin(kθ + φₖ)
//
// which closes exactly by construction, is smooth everywhere including at
// θ = 0, and has a curvature with a closed form — so how tight the tightest
// corner is can be ASKED of the shape rather than measured off a polyline
// and hoped for. Two harmonics of it read as a bent oval, three as a track
// with corners of different sizes, and where a harmonic's aₖ·k² passes 1
// the curve turns CONCAVE and the loop grows a real counter bend, which is
// what R29's `turn` is actually buying.
//
// The shape is drawn at unit radius and SCALED to the lap length the level
// wants. That is the whole reason for drawing it this way round: both the
// perimeter and the curvature of a polar curve scale linearly with the mean
// radius, so one pass over the unit shape gives the scale that hits the lap
// band exactly and the radius the tightest corner will come out at, before
// a single point of the real loop is built.
//
// THE MARKS (R31) are then read off the finished line rather than placed on
// it: every bend that turns one way for long enough carries a rock at the
// centre of its turn, and the rounding is verified with `roundingAbout` —
// the same function the analysis re-checks the finished level with, so the
// search cannot accept a rounding the scoreboard would refuse.

import { TAU } from "../lib/math.ts";
import type { Rng } from "../lib/prng.ts";
import { polylineDistance } from "../lib/polyline.ts";
import { LEVEL_RULES as R, inBand, solidBerth, withinBand } from "./rules.ts";
import type { Mark, Route } from "./route.ts";
import type { Vec2 } from "./types.ts";

/** How finely the unit shape is sampled before it is resampled by arc
 * length, in samples per turn. Fine enough that the perimeter it measures
 * is inside a tenth of a metre of the true one on the biggest lap in the
 * band, which is what the lap's own gate spacing is then divided out of. */
const SAMPLES = 1024;

/** The harmonics warping the mean radius: their numbers, their swings as a
 * share of that radius, and where each one's crest stands. */
type Shape = {
  readonly k: readonly number[];
  readonly a: readonly number[];
  readonly phase: readonly number[];
};

/** The unit shape's radius at an angle, with its first two derivatives —
 * everything the polar curvature below asks for, summed once. */
function radiusAt(shape: Shape, t: number): { r: number; d1: number; d2: number } {
  let r = 1;
  let d1 = 0;
  let d2 = 0;
  for (let i = 0; i < shape.k.length; i++) {
    const k = shape.k[i];
    const a = shape.a[i];
    const at = k * t + shape.phase[i];
    r += a * Math.sin(at);
    d1 += a * k * Math.cos(at);
    d2 -= a * k * k * Math.sin(at);
  }
  return { r, d1, d2 };
}

/** The SIGNED curvature of the unit shape at an angle, 1/m at unit radius:
 * the standard polar form κ = (r² + 2r′² − r·r″) / (r² + r′²)^{3/2}. It
 * goes negative where the curve turns back on itself, which is the counter
 * bend R29 asks for, and the loop's real curvature is this over the scale
 * the shape is drawn at. */
function curvature(shape: Shape, t: number): number {
  const { r, d1, d2 } = radiusAt(shape, t);
  return (r * r + 2 * d1 * d1 - r * d2) / Math.pow(r * r + d1 * d1, 1.5);
}

/**
 * R31 — HOW A LINE GOES ROUND A ROCK, measured off the line and the rock
 * and nothing else.
 *
 * Three numbers, because a rounding is three things at once and any one of
 * them alone is passed by something that is not a rounding:
 *
 *   stand    how far the rock is from the line. A rock the lap encloses at
 *            three hundred metres is infield scenery.
 *   winding  how far the line swings about it over the whole lap. A closed
 *            loop winds a full turn about everything INSIDE it and nothing
 *            about anything outside, so this is the question "is the rock
 *            in the lap" asked in the only way a polyline can answer it.
 *   sweep    how much of that turn happens CLOSE to the rock — over the
 *            stations standing within `near` times the rock's own distance
 *            from the line. This is what tells a corner drawn round a rock
 *            from a lap that merely contains one: at a bend's centre the
 *            whole bend is at the rock's own range and the sweep is the
 *            bend's turn, and out in the infield the line never comes near
 *            enough to accumulate any of it.
 *
 * Read by the drawer to accept a bend's mark and by the analysis to
 * re-check it, so the two can never disagree about what a rounding is.
 */
export function roundingAbout(
  points: readonly Vec2[],
  mark: Vec2,
  near: number,
): { stand: number; winding: number; sweep: number } {
  const stand = polylineDistance(points, mark.x, mark.z);
  const reach = stand * near;
  let winding = 0;
  let sweep = 0;
  let last: number | null = null;
  let lastNear = false;
  for (const p of points) {
    const angle = Math.atan2(p.x - mark.x, p.z - mark.z);
    const isNear = Math.hypot(p.x - mark.x, p.z - mark.z) <= reach;
    if (last !== null) {
      let step = angle - last;
      while (step > Math.PI) step -= TAU;
      while (step < -Math.PI) step += TAU;
      winding += step;
      if (isNear || lastNear) sweep += step;
    }
    last = angle;
    lastNear = isNear;
  }
  return { stand, winding, sweep: Math.abs(sweep) };
}

/**
 * R29 — HOW FAR A LAP TURNS IN ALL, rad: every heading change along it,
 * added up without regard to which way.
 *
 * The measure R22's "longer than its own chord" cannot be for a closed
 * line. A circle turns exactly 2π going round once and so does any loop
 * that only ever bulges outward, because every metre of it curves the same
 * way; the only thing that can push the total past 2π is line that turned
 * BACK, which is what a corner on a circuit is made of.
 *
 * Read by the drawer on the raw loop as a cheap first filter, by the course
 * on the LAP THAT SHIPS once an air gate's window has been cut straight out
 * of it (R9, which takes a corner's worth of turning away), and by the
 * analysis on the published path. One function, so a lap the search called
 * a track cannot be a lap the scoreboard calls a ring road.
 */
export function lapTurn(points: readonly Vec2[]): number {
  let turn = 0;
  for (let i = 1; i + 1 < points.length; i++) {
    const h0 = Math.atan2(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
    const h1 = Math.atan2(points[i + 1].x - points[i].x, points[i + 1].z - points[i].z);
    let d = h1 - h0;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    turn += Math.abs(d);
  }
  return turn;
}

/** The centre of the circle through three plan points, or null where they
 * are too near a straight line for one to mean anything. */
function circumcentre(a: Vec2, b: Vec2, c: Vec2): Vec2 | null {
  const d = 2 * (a.x * (b.z - c.z) + b.x * (c.z - a.z) + c.x * (a.z - b.z));
  if (Math.abs(d) < 1e-6) return null;
  const a2 = a.x * a.x + a.z * a.z;
  const b2 = b.x * b.x + b.z * b.z;
  const c2 = c.x * c.x + c.z * c.z;
  return {
    x: (a2 * (b.z - c.z) + b2 * (c.z - a.z) + c2 * (a.z - b.z)) / d,
    z: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d,
  };
}

/** R29 — draw a circuit, or return null when this seed's shapes all come
 * out too tight for R23, too near themselves, or with no bend worth
 * standing a mark in. */
export function drawCircuit(rng: Rng): Route | null {
  for (let attempt = 0; attempt < R.circuit.tries; attempt++) {
    const circuit = drawOnce(rng);
    if (circuit) return circuit;
  }
  return null;
}

function drawOnce(rng: Rng): Route | null {
  const C = R.circuit;
  // The shape: distinct harmonic numbers, so two of them never sum into one
  // slower one, and a swing apiece.
  const wanted = rng.int(C.harmonics.min, C.harmonics.max);
  const k: number[] = [];
  const a: number[] = [];
  const phase: number[] = [];
  for (let i = 0; i < wanted; i++) {
    for (let tries = 0; tries < 8; tries++) {
      const draw = rng.int(C.harmonic.min, C.harmonic.max);
      if (k.includes(draw)) continue;
      k.push(draw);
      a.push(inBand(rng, C.swing));
      phase.push(rng.range(0, TAU));
      break;
    }
  }
  if (k.length === 0) return null;
  const shape: Shape = { k, a, phase };
  const lap = inBand(rng, C.lap);
  // R29's own sea heading: a circuit runs every way, so there is nothing to
  // read the open sea's direction off — it is simply which side of the loop
  // the coast is put on.
  const seaHeading = rng.range(0, TAU);

  // ── The unit shape, and what scaling it to the lap will cost ─────────
  const unit: Vec2[] = [];
  let sharpest = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const t = (i / SAMPLES) * TAU;
    const { r } = radiusAt(shape, t);
    // A radius that has gone through zero is a shape folded inside out; the
    // swing band keeps every draw well clear of it, and this is the
    // arithmetic saying so rather than a lobe drawn through the origin.
    if (r <= 0.2) return null;
    unit.push({ x: r * Math.cos(t), z: r * Math.sin(t) });
    sharpest = Math.max(sharpest, Math.abs(curvature(shape, t)));
  }
  let unitLength = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const p = unit[i];
    const q = unit[(i + 1) % SAMPLES];
    unitLength += Math.hypot(q.x - p.x, q.z - p.z);
  }
  const scale = lap / unitLength;
  // R23 — the tightest corner the finished loop will carry. Both the
  // perimeter and the curvature scale with the mean radius, so this is the
  // real answer and not an estimate: a shape whose corners are tighter than
  // a hull can hold is refused here, before anything is built.
  if (scale / sharpest < R.course.radius) return null;

  // ── The line itself, resampled by arc length ─────────────────────────
  // The start stands at the STRAIGHTEST point of the lap. It is the line
  // the race is started behind and crossed on every lap (R30), and a start
  // line laid across a hairpin is a start nobody can take.
  let straightest = 0;
  let flattest = Infinity;
  for (let i = 0; i < SAMPLES; i++) {
    const c = Math.abs(curvature(shape, (i / SAMPLES) * TAU));
    if (c < flattest) {
      flattest = c;
      straightest = i;
    }
  }
  const fine: Vec2[] = [];
  const fineCum: number[] = [0];
  for (let i = 0; i <= SAMPLES; i++) {
    const p = unit[(straightest + i) % SAMPLES];
    fine.push({ x: p.x * scale, z: p.z * scale });
    if (i > 0) {
      const q = fine[i - 1];
      fineCum.push(fineCum[i - 1] + Math.hypot(fine[i].x - q.x, fine[i].z - q.z));
    }
  }
  const length = fineCum[SAMPLES];
  if (!withinBand(length, C.lap)) return null;
  const count = Math.max(8, Math.round(length / R.route.step));
  const step = length / count;
  const points: Vec2[] = [];
  const along = new Float64Array(count + 1);
  {
    let j = 0;
    for (let i = 0; i <= count; i++) {
      const at = Math.min(i * step, length);
      while (j + 1 < SAMPLES && fineCum[j + 1] < at) j++;
      const span = fineCum[j + 1] - fineCum[j] || 1;
      const t = (at - fineCum[j]) / span;
      points.push({
        x: fine[j].x + (fine[j + 1].x - fine[j].x) * t,
        z: fine[j].z + (fine[j + 1].z - fine[j].z) * t,
      });
      along[i] = at;
    }
    // The loop CLOSES: the last point is the first, exactly, so the seam is
    // a join rather than a gap of a few centimetres that every lap after
    // the first would ride round.
    points[count] = { x: points[0].x, z: points[0].z };
  }

  // ── R29 — what the drawn line has to hold ────────────────────────────
  // A first filter only: `layCircuitCourse` asks the same question again of
  // the lap that ships, which is the one with an air gate's straight cut
  // out of it.
  if (!withinBand(lapTurn(points), C.turn)) return null;
  // …and it does not come back on itself. Measured the SHORT way round the
  // loop, because on a closed line two stations a step apart are also a lap
  // apart and only the nearer of the two spans says anything about them.
  const skip = Math.ceil(C.selfSpan / step);
  for (let i = 0; i < count; i++) {
    for (let j = i + skip; j < count; j++) {
      if (count - (j - i) < skip) continue;
      const dx = points[j].x - points[i].x;
      const dz = points[j].z - points[i].z;
      if (dx * dx + dz * dz < C.selfClear * C.selfClear) return null;
    }
  }

  const marks = layMarks(rng, points, step);
  if (marks.length < C.mark.count.min) return null;

  const widths = new Float64Array(count + 1).fill(R.route.corridor.max);
  return { points, along, widths, length, seaHeading, closed: true, marks, leg: null };
}

/**
 * R31 — THE MARKS, read off the bends the loop turned out to have.
 *
 * A bend is a maximal run of line turning the same way. Where one turns far
 * enough (`mark.wrap`), the circle through its two ends and its middle says
 * where its centre is, and a rock goes there — so the line is already drawn
 * round it and nothing has to be moved to make the rounding true.
 *
 * Every candidate is then put to `roundingAbout`, which is the analysis's
 * own instrument: the rock has to stand inside the band off the line, the
 * lap has to enclose it, and the swing about it has to happen at its own
 * range rather than be the winding a closed loop gives anything inside it.
 * The strongest bends win, and two marks inside `mark.apart` of each other
 * along the lap are one corner counted twice.
 */
function layMarks(rng: Rng, points: readonly Vec2[], step: number): Mark[] {
  const C = R.circuit;
  const count = points.length - 1;
  const heading = (i: number): number => {
    const a = points[i % count];
    const b = points[(i + 1) % count];
    return Math.atan2(b.x - a.x, b.z - a.z);
  };
  // The signed turn at every station, walked once round with the seam
  // included so a bend astride it is one bend.
  const bends: { from: number; to: number; turn: number }[] = [];
  let runFrom = 0;
  let runTurn = 0;
  for (let i = 0; i < count; i++) {
    let d = heading(i + 1) - heading(i);
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    if (runTurn !== 0 && Math.sign(d) !== Math.sign(runTurn)) {
      bends.push({ from: runFrom, to: i, turn: runTurn });
      runFrom = i;
      runTurn = 0;
    }
    runTurn += d;
  }
  bends.push({ from: runFrom, to: count, turn: runTurn });
  // A bend astride the seam is ONE bend: the start stands at the flattest
  // point of the lap so this is rare, but a corner split in two is a corner
  // neither half of which turns far enough to earn its mark.
  if (bends.length > 1 && Math.sign(bends[0].turn) === Math.sign(bends[bends.length - 1].turn)) {
    const tail = bends.pop();
    if (tail) {
      bends[0] = { from: tail.from - count, to: bends[0].to, turn: tail.turn + bends[0].turn };
    }
  }
  bends.sort((p, q) => Math.abs(q.turn) - Math.abs(p.turn));

  const lap = count * step;
  const on = (i: number): Vec2 => points[((i % count) + count) % count];
  const marks: Mark[] = [];
  const taken: number[] = [];
  for (const bend of bends) {
    if (marks.length >= C.mark.count.max) break;
    if (Math.abs(bend.turn) < C.mark.wrap) continue;
    const mid = Math.floor((bend.from + bend.to) / 2);
    const centre = circumcentre(on(bend.from), on(mid), on(bend.to));
    if (!centre) continue;
    // One corner is one mark: bends are taken strongest first, so a later
    // run of the same corner's own turning finds its neighbour already
    // standing there. Measured the short way round, as everything on a loop
    // is.
    const at = (((mid * step) % lap) + lap) % lap;
    if (taken.some((t) => Math.min(Math.abs(t - at), lap - Math.abs(t - at)) < C.mark.apart)) {
      continue;
    }
    const r = inBand(rng, R.solids.mark.r);
    const top = inBand(rng, R.solids.mark.top);
    const round = roundingAbout(points, centre, C.mark.near);
    if (!withinBand(round.stand, C.mark.stand)) continue;
    if (round.stand < r + solidBerth(r) + R.search.marginSlack) continue;
    if (Math.abs(round.winding) < TAU - 0.5) continue;
    if (round.sweep < C.mark.wrap) continue;
    if (
      marks.some((m) => Math.hypot(m.x - centre.x, m.z - centre.z) < m.r + r + R.solids.spacing)
    ) {
      continue;
    }
    marks.push({ x: centre.x, z: centre.z, r, top, zone: round.stand });
    taken.push(at);
  }
  return marks;
}
