// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE OPEN OCEAN — what lies past the edge of the built level.
//
// A level is a stretch of coast baked onto a grid a couple of kilometres
// across (R14), and everything inside it is read off that grid. The water
// does not stop where the grid does. A rider who turns his back on the
// course and holds the throttle open rides OUT, and out there the coast
// stops sheltering him: the wind freshens, the bed falls away, and the sea
// builds the whole way until it is a twenty-metre storm.
//
// None of that can be baked — a grid reaching far enough out would be a
// level's whole build time spent on water nobody rides — so past the rim
// the ocean is ANALYTIC. This module is the whole of it, and it is one
// question with three answers, HOW FAR OUT IS THIS:
//
//   `oceanOffset`  how far out of the box a point is along each axis, m,
//                  signed and pointing away from the level. The bounds ARE
//                  the grid's (R14), so it is also how far past the last
//                  cell of every field a sample lies — which is what
//                  `water.ts` carries a wave's phase on by.
//   `stormRamp`    that distance as a share, 0 at the rim and 1 at
//                  `sea.open.reach`: how much of the storm a point is in.
//                  THE one ramp. The sea's height, the bed's depth and the
//                  wind's strength are all read off it, so they cannot
//                  drift apart.
//   `oceanDepth`   the bed out there: the rim's own depth falling on to
//                  `sea.open.depth`, which is what keeps the depth-limited
//                  clip off a sea this size, and a clamped rim from standing
//                  a plateau of land out in the open ocean (`bedAt`).
//
// The sea itself is `water.ts`'s OPEN band — quoted by its height, the way
// a `SeaOverride` is, because out here there is no fetch left to grow it
// over — and the wind is `wind.ts`'s mean ramped toward `sea.open.wind`.
// Neither restates the ramp. And the EDGE of the world is `collision.ts`:
// the bounds hold a rider in where the grid's rim stands on land and let
// him out where it stands in open water.
//
// Deterministic and stateless: functions of a level's bounds and a plan
// point, with no clock and no randomness.

import { sampleField } from "../lib/heightfield.ts";
import { clamp } from "../lib/math.ts";
import type { Bounds, Level } from "../mapgen/types.ts";
import { TUNING } from "./defs/tuning.ts";

const O = TUNING.sea.open;

/** How far OUT of the box a point is along each axis, m — signed, pointing
 * away from the level, and 0 on an axis the point is inside — written into
 * `out` as [x, z]. Returns the distance past the bounds, which is 0
 * anywhere inside them.
 *
 * Written into a caller's array rather than returned as a pair because
 * `surfaceAt` wants both the distance and the direction and is called tens
 * of thousands of times a frame. */
export function oceanOffset(bounds: Bounds, x: number, z: number, out: Float64Array): number {
  const ox = x < bounds.minX ? x - bounds.minX : x > bounds.maxX ? x - bounds.maxX : 0;
  const oz = z < bounds.minZ ? z - bounds.minZ : z > bounds.maxZ ? z - bounds.maxZ : 0;
  out[0] = ox;
  out[1] = oz;
  return ox === 0 ? (oz === 0 ? 0 : Math.abs(oz)) : oz === 0 ? Math.abs(ox) : Math.hypot(ox, oz);
}

const offset = new Float64Array(2);

/** Metres past the level's bounds, 0 inside them. */
export function oceanOut(bounds: Bounds, x: number, z: number): number {
  return oceanOffset(bounds, x, z, offset);
}

/** How much of the storm stands `out` metres past the rim: 0 at the rim, 1
 * at `sea.open.reach` and past it. Linear in the distance, because what
 * reads as an ocean getting worse is a sea that grows every second you hold
 * the throttle open; and CAPPED, because every term that multiplies an
 * amplitude needs a ceiling beside it. An arcade dial, not a law. */
export function stormRamp(out: number): number {
  return clamp(out / O.reach, 0, 1);
}

/** The same, at a plan point. */
export function stormAt(bounds: Bounds, x: number, z: number): number {
  return stormRamp(oceanOut(bounds, x, z));
}

/** The depth of water, m, where the level's own bed reads `bed` metres and
 * the storm stands at `storm`: inside the level the bed itself, and out past
 * the rim that bed falling on to `sea.open.depth`.
 *
 * The sea's significant height is clipped to `TUNING.sea.breakingHs`·d, so
 * the open ocean's sea only stands its quoted height if there is depth under
 * it — and the heightfield's sampler clamps to its edge cell, which is
 * whatever thirty-odd metres the rim happens to hold. Undone, that flattens
 * a twenty-metre sea to fifteen. Nothing else needs this: the grounding and
 * the renderer's terrain ask "is there a bottom within reach here", and a
 * clamped rim already answers no. */
export function oceanDepth(bed: number, storm: number): number {
  return bed + Math.max(0, O.depth - bed) * storm;
}

/** THE BOTTOM at a plan point, m against sea level — the level's own
 * ground inside its grid, and out past the rim that ground falling away to
 * the open ocean's floor. The one answer to "what is under the water here",
 * asked two ways: `water.ts` reads it as the depth its breaking clip is
 * measured against, and `collision.ts` as the bottom a hull can ground on.
 *
 * It matters because the heightfield's sampler clamps to its EDGE CELL, so
 * the rim's last row is repeated forever outward — which past the seaward
 * rim is thirty-odd metres of water holding a twenty-metre sea down to
 * fifteen, and past a corner where the coast happened to reach the box is a
 * plateau of land standing out in the open ocean. */
export function bedAt(level: Level, x: number, z: number): number {
  const ground = sampleField(level.ground, x, z);
  const storm = stormAt(level.bounds, x, z);
  return storm > 0 ? -oceanDepth(-ground, storm) : ground;
}

/** The MEAN WIND a point feels, m/s at the reference height: the level's own
 * `mean` under that point's `shelter` (0..1, `fetch.ts`), both giving way to
 * the open ocean's storm as the coast falls astern — the mean freshening
 * toward `sea.open.wind` and the shelter opening out to 1, because a coast
 * two kilometres upwind shelters nothing.
 *
 * A level already blowing harder than the storm keeps its own wind rather
 * than dropping to it. Zero stays zero — a calm level has no storm out at
 * sea, the same rule that keeps `createSea` from building a spectrum on a
 * wind of nothing. */
export function oceanWind(mean: number, shelter: number, storm: number): number {
  if (mean <= 0) return 0;
  const speed = mean + Math.max(0, O.wind - mean) * storm;
  return speed * (shelter + (1 - shelter) * storm);
}
