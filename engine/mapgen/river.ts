// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R26 — THE RIVER RUNS ON. The race stops; the water does not.
//
// A course that ends up a channel ends at a wall of nothing: the corridor
// the route was owed stops at the last station and the water stops with
// it, and a rider who turns round past the finish and rides on meets the
// edge of a level rather than the head of a river. Which is the tell that
// the water was drawn for the race instead of the race being laid in the
// water.
//
// So the inland end of the route is a MOUTH, and the river goes on from it
// into the country: a meandering walk of `river.length` that keeps heading
// inland until it stands at least `river.inland` metres from the sea it
// came out of, THINNING as it goes — `river.taper` from the corridor's own
// half-width at the mouth down to `river.head` at its head. Nothing else
// has to be built to stop the rider: the bed is a function of how far a
// point is from the water's edge (R3), so a channel that narrows shoals
// with itself, and the last stretch is a creek a hull grounds in. That is
// the "no further" the rule wants — the water running out, not a fence.
//
// It is the ROUTE'S water, drawn the same way and stamped into the same
// field (R15): the basin does not know the difference between a sample of
// the racing line and a sample of the river, only the half-width each one
// is owed. What the river must not do is find the race again — a reach
// that wanders back into the corridor is a second mouth, and a rider who
// takes it is off the course with no way of telling. So every point past
// the mouth's own run keeps `river.clear` off the line, and a walk that
// cannot is redrawn.
//
// WHAT KIND OF RIVER IT IS IS THE COAST'S (`Biome.river`). The rule book's
// numbers draw the taiga's — a rock channel that closes fast and runs hard
// — and every other coast draws its own as multiples of them: how wide the
// mouth opens, how slowly the width closes, how big the loops are, how much
// water comes down it, and whether there are BARS in the mouth. A river is
// most of what a rider sees of the country past the race, and two coasts
// with the same river are one coast with two paint jobs.

import { angleDiff, clamp } from "../lib/math.ts";
import { valueNoise } from "../lib/noise.ts";
import type { Rng } from "../lib/prng.ts";
import type { Island } from "./basin.ts";
import type { RiverShape } from "./biomes.ts";
import type { Route } from "./route.ts";
import { LEVEL_RULES as R, inBand } from "./rules.ts";
import type { Vec2 } from "./types.ts";

export type River = {
  /** The centreline, MOUTH FIRST — the way the water comes down it. */
  readonly points: readonly Vec2[];
  /** Half-width of water owed at each point, m: the corridor's (times the
   * coast's `mouth`) at the mouth, `river.head` at the head. */
  readonly widths: Float64Array;
  /** How far the head stands from the mouth in a straight line, m. */
  readonly inland: number;
  readonly length: number;
  /** R27 — how much water it carries out of its mouth, m³/s. Drawn per
   * level inside the coast's own band: a coast has lazy rivers and it has
   * torrents, and which one this is decides what the current does to a
   * hull. */
  readonly discharge: number;
  /** THE BARS in the mouth (`RiverShape.bars`): the delta's islands, cut
   * out of the water by the basin exactly as R15's islands are. Empty on a
   * coast whose rivers leave through one channel. */
  readonly bars: readonly Island[];
};

/** The tightest circle the meander turns at on this coast, m, and the
 * period it turns over: the rule book's, scaled together by `bend` so the
 * shape is the same shape drawn bigger. */
function meanderOf(shape: RiverShape): { radius: number; scale: number } {
  return { radius: R.river.radius * shape.bend, scale: R.river.swingScale * shape.bend };
}

/**
 * THE MOUTH: the station of the route the open sea is furthest from, and
 * the half-width of water owed there.
 *
 * A station rather than an end, and that is what makes the river something
 * a rider can actually get to. A river hung off the route's LAST point is
 * a river behind the finish gate, and a run is over the moment that line
 * is crossed; the most inland station of the line is a place the race goes
 * PAST — the bend where the course is deepest into the land — so a rider
 * who wants the country turns off there and rides up, mid-run, and comes
 * back to the course when he has had enough. Where the route does end
 * inland, that end IS the most inland station and this is the same thing.
 *
 * The water leaves at a right angle to the race, because the most inland
 * station is where the line stops going inland and starts coming out
 * again: its own heading is across the way inland lies, and the river's
 * is straight up it.
 */
function mouthOf(route: Route): { at: Vec2; width: number; heading: number; u: number } {
  const { points, widths } = route;
  const sx = Math.sin(route.seaHeading);
  const sz = Math.cos(route.seaHeading);
  // Searched over the stretch of line the RACE is certainly laid on —
  // R10's shortest course, less the run in which its own finish falls — so
  // the mouth is a bend the rider passes rather than one behind the finish
  // gate, which is a mouth nobody can reach without ending their run.
  const raced = R.course.length.min - R.gate.spacing.max;
  let best = 0;
  let lowest = Infinity;
  for (let i = 0; i < points.length; i++) {
    if (route.along[i] > raced) break;
    const u = points[i].x * sx + points[i].z * sz;
    if (u < lowest) {
      lowest = u;
      best = i;
    }
  }
  return {
    at: points[best],
    width: widths[best],
    heading: route.seaHeading + Math.PI,
    u: lowest,
  };
}

/**
 * Draw the river that runs on inland from the route's mouth, or null when
 * this route has no inland end to run one from.
 *
 * The walk is the route's own (a smooth noise turning inside a bounded
 * curvature) with one thing added and one taken away: it is pulled toward
 * the way INLAND lies, because a river that meanders back out to sea is a
 * bay, and it has no reason to avoid itself — a watercourse that runs close
 * to its own next bend is an oxbow, which is a thing rivers do.
 */
export function drawRiver(
  rng: Rng,
  route: Route,
  seaOffset: number,
  shape: RiverShape,
): River | null {
  const mouth = mouthOf(route);
  // A mouth has to be up the channel to begin with. One cut into the open
  // sea's own straight edge is a bay with a stream in it, and the river
  // this rule is about starts where the land already closes round it.
  if (mouth.u > seaOffset - R.river.mouthInshore) return null;
  const inland = route.seaHeading + Math.PI;
  const step = R.river.step;
  const meander = meanderOf(shape);
  const maxTurn = step / meander.radius;

  for (let attempt = 0; attempt < R.river.tries; attempt++) {
    const turnSeed = rng.int(1, 0x7fffffff);
    const swing = inBand(rng, R.river.swing);
    const want = inBand(rng, R.river.inland);
    const points: Vec2[] = [mouth.at];
    let x = mouth.at.x;
    let z = mouth.at.z;
    let heading = mouth.heading;
    let s = 0;
    let reached = 0;
    let clean = true;
    while (s < R.river.length.max) {
      const turn = (valueNoise(s, 0, meander.scale, turnSeed) - 0.5) * 2 * swing * maxTurn;
      // The pull inland. It is what makes the walk a river running out of
      // the country rather than a channel wandering along the coast, and
      // it is weak enough that the meander still owns the shape.
      const pull = clamp(angleDiff(heading, inland), -maxTurn, maxTurn) * R.river.pull;
      heading += clamp(turn + pull, -maxTurn, maxTurn);
      x += Math.sin(heading) * step;
      z += Math.cos(heading) * step;
      s += step;
      points.push({ x, z });
      reached = Math.hypot(x - mouth.at.x, z - mouth.at.z);
      // Past the mouth's own run it is a different watercourse from the
      // race, and it stays one.
      if (s > R.river.mouthRun) {
        for (const p of route.points) {
          if (Math.hypot(p.x - x, p.z - z) < R.river.clear) {
            clean = false;
            break;
          }
        }
        if (!clean) break;
      }
      if (reached >= want && s >= R.river.length.min) break;
    }
    if (!clean || reached < want) continue;
    // THE TAPER: the mouth's half-width down to the head's, and the power
    // is what makes it read as a river rather than as a wedge — over 1,
    // most of the narrowing happens in the first third, the way a
    // watercourse loses its tributaries. All three are the coast's: the
    // mouth is the corridor's own half-width times what the coast opens it
    // to, held under R1's ceiling less the search's slack because the race
    // is laid through it, and never narrower than the head.
    const widths = new Float64Array(points.length);
    const head = R.river.head * shape.head;
    const ceiling = R.course.offshore.max - R.search.offshoreSlack;
    const mouthWidth = Math.max(Math.min(mouth.width * shape.mouth, ceiling), head);
    const taper = R.river.taper * shape.taper;
    for (let i = 0; i < points.length; i++) {
      const t = i / (points.length - 1);
      widths[i] = head + (mouthWidth - head) * Math.pow(1 - t, taper);
    }
    const river = {
      points,
      widths,
      inland: reached,
      length: s,
      discharge: inBand(rng, R.river.discharge) * shape.discharge,
    };
    // The bars are drawn LAST, and only on a coast that has them, so a
    // coast without a delta draws exactly what it drew before the delta was
    // a thing a river could have.
    return { ...river, bars: shape.bars ? drawBars(rng, route, river, shape.bars) : [] };
  }
  return null;
}

/** Where the river stands `s` metres of walking up from its mouth: the
 * point, the half-width owed there and the line's direction. */
function stationAt(
  river: { points: readonly Vec2[]; widths: Float64Array },
  s: number,
): { x: number; z: number; width: number; dx: number; dz: number } {
  const { points, widths } = river;
  let at = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    const span = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    if (at + span >= s || i + 2 === points.length) {
      const t = clamp((s - at) / span, 0, 1);
      return {
        x: a.x + (b.x - a.x) * t,
        z: a.z + (b.z - a.z) * t,
        width: widths[i] + (widths[i + 1] - widths[i]) * t,
        dx: (b.x - a.x) / span,
        dz: (b.z - a.z) / span,
      };
    }
    at += span;
  }
  return { x: points[0].x, z: points[0].z, width: widths[0], dx: 0, dz: 1 };
}

/**
 * THE BARS: the delta's islands, placed by rejection in the mouth's reach.
 *
 * Each stands beside the centreline rather than on it — offset across the
 * river by at least its own warped radius plus the channel the coast keeps
 * open, and at most the water's edge — so the river still runs past it on
 * both sides and R26's walk up the centreline never finds it dry. It keeps
 * R15's own clearance off the racing line, because the mouth's reach IS
 * the race's water for its first run and a bar cut into the corridor is a
 * rock the course was not drawn round; and it keeps `island.apart` from
 * the bars already standing. A bar that finds no legal spot in its tries is
 * not placed: a delta with one island fewer is still a delta.
 */
function drawBars(
  rng: Rng,
  route: Route,
  river: { points: readonly Vec2[]; widths: Float64Array; length: number },
  rule: NonNullable<RiverShape["bars"]>,
): Island[] {
  const bars: Island[] = [];
  const wanted = rng.int(rule.count.min, rule.count.max);
  const warp = 1 + R.island.warp;
  for (let n = 0; n < wanted; n++) {
    for (let attempt = 0; attempt < R.island.tries; attempt++) {
      const s = Math.min(inBand(rng, rule.reach), river.length);
      const r = inBand(rng, rule.r);
      const side = rng.chance(0.5) ? 1 : -1;
      const at = stationAt(river, s);
      // Across the river: from the channel's edge to the water's edge, and
      // a reach too narrow to hold both is a reach with no room for a bar.
      const near = r * warp + rule.channel;
      const far = at.width - r * (1 - R.island.warp) * 0.5;
      const across = rng.range(near, Math.max(near, far));
      if (far < near) continue;
      const x = at.x - at.dz * side * across;
      const z = at.z + at.dx * side * across;
      let clear = true;
      for (let i = 0; i < route.points.length && clear; i++) {
        const p = route.points[i];
        if (Math.hypot(p.x - x, p.z - z) < route.widths[i] + r * warp + R.island.clear)
          clear = false;
      }
      if (!clear) continue;
      if (bars.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r + R.island.apart)) continue;
      bars.push({ x, z, r, seed: rng.int(1, 0x7fffffff) });
      break;
    }
  }
  return bars;
}

/** How far a plan point is from the river's line, m — what the basin's
 * islands and anything else placed near it has to ask. */
export function riverDistance(river: River, x: number, z: number): number {
  let best = Infinity;
  for (const p of river.points) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < best) best = d;
  }
  return best;
}
