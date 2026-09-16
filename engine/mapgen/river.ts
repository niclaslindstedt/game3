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
// NOR MAY IT FIND ITSELF. The basin stamps water wherever a sample of the
// line stands, so two reaches that come within their own half-widths of
// each other do not draw as two reaches: they merge, and what the rider
// gets is a lake with a knot in it — or, where they cross outright, a
// river laid over itself like a road with an underpass, which is the one
// thing a watercourse cannot be. A loop that closes on its own water is a
// loop a river has ALREADY stopped making: the neck breaks, the water
// takes the short way, and the loop is left beside the channel as an
// oxbow rather than in it as a crossing. So the walk is refused when two
// of its reaches stand closer than the water they carry plus
// `river.selfBank` of neck — the same shape as R24's rule for the racing
// line, measured against the WIDTH rather than against a fixed clearance,
// because this line's water goes from the corridor's own half-width at
// the mouth to a three-metre creek at the head.
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
 * THE TIGHTEST CIRCLE THE WATER ITSELF CAN TURN AT, m.
 *
 * A river bends at a radius its own channel allows: a creek wriggles round
 * a boulder and a river a hundred metres across does not, and the reason
 * is not taste — a bend tighter than the water is wide has the channel
 * running into itself on the inside of the turn. Real meanders come in at
 * a couple of channel widths of curvature and up; this takes
 * `river.bendWidths` of the HALF-width and never less than the coast's own
 * `radius`, which is what the creek at the head ends up turning at.
 *
 * Stating it against the width rather than as one number is what makes
 * R26's self-clearance findable: the walk's tightest loop then opens out
 * with the water in it, instead of the widest reach of every river folding
 * onto itself and the whole route being thrown away for want of one.
 */
export function bendRadius(width: number, floor: number): number {
  return Math.max(floor, width * R.river.bendWidths);
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
 * curvature) with one thing added: it is pulled toward the way INLAND
 * lies, because a river that meanders back out to sea is a bay. What it
 * keeps is the route's self-clearance (R24), sized off the water each
 * reach carries rather than off one number — a river that runs into its
 * own water is a lake where the reaches merge and an impossibility where
 * they cross.
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
  // THE TAPER: the mouth's half-width down to the head's, and the power is
  // what makes it read as a river rather than as a wedge — over 1, most of
  // the narrowing happens in the first third, the way a watercourse loses
  // its tributaries. All three are the coast's: the mouth is the
  // corridor's own half-width times what the coast opens it to, held under
  // R1's ceiling less the search's slack because the race is laid through
  // it, and never narrower than the head.
  const head = R.river.head * shape.head;
  const ceiling = R.course.offshore.max - R.search.offshoreSlack;
  const mouthWidth = Math.max(Math.min(mouth.width * shape.mouth, ceiling), head);
  const taper = R.river.taper * shape.taper;
  // …and it is read off how far INLAND the walk has got rather than off how
  // far it has WALKED, which is both the truer model and the thing that
  // makes the walk able to answer for itself. A river thins because its
  // catchment shrinks going up, not because it wandered: a reach that
  // spends three hundred metres on one loop comes out of it the width it
  // went in. And because the target is drawn before the first step, the
  // width at the point being walked is known AT that step — which is what
  // the turning circle and the self-clearance below are both stated
  // against.
  const widthAt = (reached: number, want: number): number =>
    head + (mouthWidth - head) * Math.pow(1 - clamp(reached / want, 0, 1), taper);

  for (let attempt = 0; attempt < R.river.tries; attempt++) {
    const turnSeed = rng.int(1, 0x7fffffff);
    const swing = inBand(rng, R.river.swing);
    const want = inBand(rng, R.river.inland);
    const points: Vec2[] = [mouth.at];
    const widths: number[] = [widthAt(0, want)];
    let x = mouth.at.x;
    let z = mouth.at.z;
    let heading = mouth.heading;
    let s = 0;
    // The taper follows the FURTHEST the walk has been from the mouth, not
    // where it is now: a loop that turns back for a step is still the same
    // way up its own catchment, and a river that widened again on the way
    // inland would be two rivers.
    let reached = 0;
    let clean = true;
    while (s < R.river.length.max) {
      const maxTurn = step / bendRadius(widths[widths.length - 1], meander.radius);
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
      reached = Math.max(reached, Math.hypot(x - mouth.at.x, z - mouth.at.z));
      widths.push(widthAt(reached, want));
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
    // …and where the walk ran back into its own water, it is redrawn.
    if (!clearOfItself(points, widths, meander.radius)) continue;
    const river = {
      points,
      widths: Float64Array.from(widths),
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

/** R26 — the walk along the water past which two reaches standing close
 * means they closed a loop rather than that one is coming out of a bend,
 * m: `river.selfSpan` of the hairpin a channel this wide could have turned
 * (π·its own bend radius). A multiple rather than a distance, because the
 * same river turns at a hundred metres of radius at its mouth and at the
 * coast's own floor at its head. */
function selfSpanAt(width: number, floor: number): number {
  return Math.PI * bendRadius(width, floor) * R.river.selfSpan;
}

/**
 * R26 — does the walk keep clear of its OWN water?
 *
 * Two reaches have to stand further apart than the half-widths they each
 * carry, with `river.selfBank` of neck between them — compared only
 * between reaches far enough apart ALONG the water for the closeness to
 * mean anything (`selfSpanAt`), because a line coming out of its own
 * hairpin stands beside itself by construction and that is a bend.
 *
 * The walk's steps are all `river.step` long, so the span along the water
 * is a count of them and no cumulative length is needed.
 */
function clearOfItself(points: readonly Vec2[], widths: readonly number[], floor: number): boolean {
  for (let i = 0; i < points.length; i++) {
    // The water only ever narrows going up, so the wider of any pair is
    // the one nearer the mouth and its own hairpin is the longer walk.
    const skip = Math.ceil(selfSpanAt(widths[i], floor) / R.river.step);
    for (let j = i + skip; j < points.length; j++) {
      const need = widths[i] + widths[j] + R.river.selfBank;
      const dx = points[j].x - points[i].x;
      const dz = points[j].z - points[i].z;
      if (dx * dx + dz * dz < need * need) return false;
    }
  }
  return true;
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
