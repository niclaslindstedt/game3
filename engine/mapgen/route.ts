// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R24 — THE ROUTE: the racing line, drawn BEFORE there is any land.
//
// This is the inversion the whole generator turns on. A shore-first
// generator draws a coast and then looks for a line along it, and what it
// can find is always a line ALONG it: the course is as straight as the
// coast is, and no amount of wandering in the coast makes a corner the
// rider has to steer round rather than lean through. Wave Race's maps are
// the other way about — a basin with a route through it, the land put where
// the route is not — and so is this.
//
// So the route is a free walk in the plane. It starts at the origin on a
// drawn heading and steps `route.step` metres at a time, turning by a rate
// read off a smooth noise and clamped to the tightest circle a hull can
// hold (R23). The noise has real amplitude: over a few hundred metres the
// heading can swing right round, which is what puts hairpins and dog-legs
// in a course rather than the long shallow bends a coastline gives.
//
// Three things keep the walk honest. It is pulled back toward the middle
// when it strays past `route.reach`, so a level stays a compact place
// rather than a line receding into the distance. It STEERS AWAY from the
// legs it has already ridden, because a course packed into a basin will
// otherwise fold onto itself — and two legs of a course that nearly touch
// are two legs a rider cannot tell apart, with a gate on one crossed while
// riding the other. And when the avoidance loses anyway it is REJECTED, so
// the rule is a rule rather than a preference.
//
// Every point carries the half-width of water it is owed (`widths`). That
// number is what R1 and R5 become: a corridor 2·`course.offshore.min` wide
// at its narrowest has water inside R1's band by construction, and the bed
// profile under it is deep enough for R5 without a search. The old
// station-push loop existed only to find that by trial; here it is drawn.

import { clamp, TAU } from "../lib/math.ts";
import { valueNoise } from "../lib/noise.ts";
import type { Rng } from "../lib/prng.ts";
import { LEVEL_RULES as R, inBand } from "./rules.ts";
import type { Vec2 } from "./types.ts";

export type Route = {
  /** The racing line, `route.step` metres apart. */
  readonly points: readonly Vec2[];
  /** Cumulative distance to each point, m. */
  readonly along: Float64Array;
  /** Half-width of water owed at each point, m. */
  readonly widths: Float64Array;
  /** The whole line's length, m. */
  readonly length: number;
};

export function drawRoute(rng: Rng): Route | null {
  const step = R.route.step;
  const count = Math.ceil(inBand(rng, R.route.length) / step) + 1;
  const heading0 = rng.range(0, TAU);
  const turnSeed = rng.int(1, 0x7fffffff);
  const widthSeed = rng.int(1, 0x7fffffff);
  const turnAmp = inBand(rng, R.route.swing);
  // The tightest circle R23 allows, as a heading change per step.
  const maxTurn = step / R.course.radius;

  const points: Vec2[] = [{ x: 0, z: 0 }];
  let x = 0;
  let z = 0;
  let heading = heading0;
  // How far back along the line a point has to be before the walk treats it
  // as a different leg, and how far out it starts pushing away from one.
  const skip = Math.ceil(R.route.selfSpan / step);
  const guard = R.route.selfClear * R.route.avoidReach;
  for (let i = 1; i < count; i++) {
    const s = i * step;
    // The turn rate: a smooth noise, so the line curves rather than
    // corners, times the amplitude this route was drawn with.
    let turn = (valueNoise(s, 0, R.route.swingScale, turnSeed) - 0.5) * 2 * turnAmp * maxTurn;
    // …and a pull back toward the middle once the walk strays, so the level
    // is a place rather than a departure. The pull is a turn, not a jump:
    // it bends the line home over a few hundred metres.
    const out = Math.hypot(x, z);
    if (out > R.route.reach) {
      const home = Math.atan2(-x, -z);
      let off = home - heading;
      while (off > Math.PI) off -= TAU;
      while (off < -Math.PI) off += TAU;
      const pull = clamp((out - R.route.reach) / R.route.reach, 0, 1);
      turn += clamp(off, -maxTurn, maxTurn) * pull;
    }
    // …and away from anything it has already ridden past. The push is the
    // sum of the directions the old legs lie in, which is what lets the
    // line thread a gap between two of them rather than being shoved into
    // one by the other.
    let px = 0;
    let pz = 0;
    for (let j = 0; j + skip < i; j++) {
      const ax = x - points[j].x;
      const az = z - points[j].z;
      const d = Math.hypot(ax, az);
      if (d > guard || d < 1e-6) continue;
      const w = (guard - d) / guard;
      px += (ax / d) * w;
      pz += (az / d) * w;
    }
    if (px !== 0 || pz !== 0) {
      let off = Math.atan2(px, pz) - heading;
      while (off > Math.PI) off -= TAU;
      while (off < -Math.PI) off += TAU;
      turn += clamp(off, -maxTurn, maxTurn) * R.route.avoid;
    }
    heading += clamp(turn, -maxTurn, maxTurn);
    x += Math.sin(heading) * step;
    z += Math.cos(heading) * step;
    points.push({ x, z });
  }

  // R24 — and where the avoidance lost, the route is refused rather than
  // shipped. Compared only between points far enough apart ALONG the line
  // for the closeness to mean anything: consecutive points are a step apart
  // by construction.
  for (let i = 0; i < points.length; i++) {
    for (let j = i + skip; j < points.length; j++) {
      const dx = points[j].x - points[i].x;
      const dz = points[j].z - points[i].z;
      if (dx * dx + dz * dz < R.route.selfClear * R.route.selfClear) return null;
    }
  }

  const along = new Float64Array(points.length);
  for (let i = 1; i < points.length; i++) {
    along[i] =
      along[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
  }
  // The corridor: a slow swell between the band's ends, so the water opens
  // out into a bay in places and closes to a channel in others, and the
  // rider reads the difference as a place changing rather than as a
  // constant-width canal.
  const widths = new Float64Array(points.length);
  for (let i = 0; i < points.length; i++) {
    const t = valueNoise(along[i], 0, R.route.corridorScale, widthSeed);
    widths[i] = R.route.corridor.min + (R.route.corridor.max - R.route.corridor.min) * t;
  }

  return { points, along, widths, length: along[along.length - 1] };
}
