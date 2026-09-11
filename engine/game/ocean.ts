// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE OPEN OCEAN — what lies past the edge of the built level.
//
// A level is a stretch of coast baked onto a grid a couple of kilometres
// across (R14), and everything inside it is read off that grid. The water
// does not stop where the grid does. A rider who turns his back on the
// course and holds the throttle open rides OUT, and out there the coast
// stops sheltering him: the wind freshens, the bed falls away, and the sea
// builds the whole way: a twenty-metre storm a couple of kilometres out,
// and, for a rider who keeps holding it open, a thousand-metre swell two
// and a half hours later (`sea.open.ladder`).
//
// None of that can be baked — a grid reaching far enough out would be a
// level's whole build time spent on water nobody rides — so past the rim
// the ocean is ANALYTIC. This module is the whole of it, and it is one
// question with four answers, HOW FAR OUT IS THIS:
//
//   `oceanOffset`  how far out of the box a point is along each axis, m,
//                  signed and pointing away from the level. The bounds ARE
//                  the grid's (R14), so it is also how far past the last
//                  cell of every field a sample lies — which is what
//                  `water.ts` carries a wave's phase on by.
//   `stormRamp`    that distance as a share of the storm, 0 at the rim and
//                  1 at `sea.open.reach`: how much of the storm a point is
//                  in. THE one ramp — the sea's height, the bed's depth and
//                  the wind's strength are all read off it, so they cannot
//                  drift apart.
//   `oceanDepth`   the bed out there: the rim's own depth falling on to
//                  `sea.open.depth`, which is what keeps the depth-limited
//                  clip off a sea this size, and a clamped rim from standing
//                  a plateau of land out in the open ocean (`bedAt`).
//
// The sea itself is `water.ts`'s OPEN band — quoted by the storm the level
// was dealt against `STORM_CEILING`, the way
// a `SeaOverride` is, because out here there is no fetch left to grow it
// over — and the wind is `wind.ts`'s mean ramped toward `sea.open.wind`.
// Neither restates a ramp. And the EDGE of the world is `collision.ts`:
// the bounds hold a rider in where the grid's rim stands on land and let
// him out where it stands in open water.
//
// Deterministic and stateless: functions of a level's bounds and a plan
// point, with no clock and no randomness.

import { sampleField } from "../lib/heightfield.ts";
import { clamp } from "../lib/math.ts";
import { smooth } from "../lib/noise.ts";
import type { Bounds, Level } from "../mapgen/types.ts";
import { CRAFT } from "./defs/craft.ts";
import { TUNING } from "./defs/tuning.ts";
import { topSpeedOf } from "./limits.ts";

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

/** THE BIGGEST SEA WORTH BUILDING, m — the one a craft doing `speed` m/s can
 * still fly over the rim of and down to the floor of.
 *
 * A sea quoted by its height is a wave of L₀ = Hs / `sea.steepness`, so the
 * run from its crest to its trough — the wave's WIDTH — is Hs/(2·steepness)
 * and grows with its height. A flight's reach does not: it is the craft's
 * own. So the two cross exactly once, and past that height the ocean stops
 * being something a rider jumps and becomes a hillside he crawls over.
 *
 * Launching off the wave's own steepest face — atan(π·steepness), a constant
 * the dial sets, 15.8° at 0.09 — at `speed` and dropping Hs, the ballistic
 * flight spans the width when
 *
 *   Hs = v²·(8·s²·cos²θ + 4·s·sinθ·cosθ) / g,   θ = atan(π·s)
 *
 * which is the closed form below: QUADRATIC in the speed, so the ocean grows
 * with the square of whatever the speed class buys.
 *
 * It is the ceiling of what is POSSIBLE, off a perfect launch. Measured in
 * the engine, a hull riding into a real sea spans about 0.45 of it on a
 * typical attempt — it leaves the water near the crest where the face has
 * already flattened, loses way climbing, and carries aero drag through the
 * flight. That gap is the difficulty, and it is deliberate: a sea nobody
 * could fail to clear is not a sea worth riding out to. */
export function jumpableHs(speed: number): number {
  const s = TUNING.sea.steepness;
  const face = Math.atan(Math.PI * s);
  const cos = Math.cos(face);
  return (speed * speed * (8 * s * s * cos * cos + 4 * s * Math.sin(face) * cos)) / TUNING.g;
}

/** ...at the roster's FASTEST craft, under the speed class — the ceiling the
 * open ocean is sized to, and the one number a level's own storm is dealt
 * against (`water.ts`). The fastest rather than an average because this is a
 * question about what CAN be ridden, and a sea the best craft can jump is
 * one the others can ride out to and be beaten by. */
export const STORM_CEILING: number = jumpableHs(Math.max(...CRAFT.map(topSpeedOf)));

/** How much of the storm stands `out` metres past the rim: 0 at the rim, 1
 * at `sea.open.reach` and past it, easing out of the one and into the other.
 * What reads as an ocean getting worse is a sea that grows every second you
 * hold the throttle open, and it is CAPPED, because every term that
 * multiplies an amplitude needs a ceiling beside it. An arcade dial, not a
 * law.
 *
 * EASED rather than straight, and the reason is the handover in `water.ts`:
 * the storm's height is carried in ENERGY over what is left of the coast's
 * sea, so the open band's amplitude comes out as the square root of this
 * ramp. A straight ramp therefore leaves the rim with an infinite slope —
 * a kink in the water exactly where a rider crosses out of the level, and
 * one `tests/waves_test.ts` measures as a step. A Hermite fade starts flat,
 * so the square root of it is straight; TWICE is flatter still, which is
 * what it takes for the biggest step across the rim to be no bigger than
 * the steps the same sea takes either side of it. The sea eases out of the
 * coast's own instead of jumping off it. */
export function stormRamp(out: number): number {
  return smooth(smooth(clamp(out / O.reach, 0, 1)));
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
 * a twenty-metre sea to fifteen. Both sides climb on the SAME ramp, which
 * is what keeps the margin: the clip asks for Hs/0.55 and the bed gives
 * about twice it at every rung of the ladder. Nothing else needs this: the grounding and
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
 * rim is thirty-odd metres of water holding the storm down to a fraction of
 * its height, and past a corner where the coast happened to reach the box
 * is a plateau of land standing out in the open ocean. */
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
