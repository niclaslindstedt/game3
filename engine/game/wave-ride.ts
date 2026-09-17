// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WAVE UNDER THE HULL — how big the one he is on is, and how far up it
// he is sitting. Two numbers, stated once here, because three things ask
// the question and none of them may answer it its own way: the score
// (`tricks.ts`, which pays for holding the top of one), a readout that
// wants to say he is on it, and the test suite that holds the rule.
//
// THE MEASUREMENT IS THE ZERO-CROSSING ONE, which is the only one a rider
// would recognise: a wave is what passes a point between one trough and the
// next, so the surface is sampled AT HIS OWN PLAN POSITION across one peak
// period of whichever band is carrying the sea there (`seaSummary`), and
// what comes back is the crest-to-trough of that sweep and where in it the
// water under him stands. It is what `make surf` counts waves with, and it
// is the reading a tangle of components cannot be read for: the sea here is
// four bands of a hundred-odd Gerstner terms and no one of them is "the
// wave".
//
// Nine samples, because the crest-to-trough converges by then (0.60 m
// against the 0.62 m thirty-three give, on a two-metre swell) and this is
// asked once a step for every rider on the water. Nothing is stored and
// nothing is random: like `surfaceAt` and `faunaPose` it is a pure function
// of (place, clock), so a run replays onto the same crests.

import { TUNING } from "./defs/tuning.ts";
import type { Level } from "../mapgen/types.ts";
import type { CraftState } from "./state.ts";
import { heightAt, seaSummary, type SeaState } from "./water.ts";

const T = TUNING.tricks;

/** The wave passing a plan point: its height crest to trough, m, and where
 * between the two the water there stands — 0 in the trough, 1 on the crest. */
export type WaveUnder = { height: number; share: number };

/** Read it into `out` (the caller keeps one; this allocates nothing). */
export function waveUnder(
  sea: SeaState,
  level: Level,
  x: number,
  z: number,
  t: number,
  out: WaveUnder,
): WaveUnder {
  const { Tp } = seaSummary(sea, x, z);
  const n = T.waveSamples;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < n; i++) {
    // Centred on now, so the sweep is the wave he is on rather than the one
    // behind or the one ahead.
    const h = heightAt(sea, level, x, z, t + (i / (n - 1) - 0.5) * Tp);
    if (h < lo) lo = h;
    if (h > hi) hi = h;
  }
  const height = hi - lo;
  const now = heightAt(sea, level, x, z, t);
  out.height = height;
  out.share = height > 1e-6 ? (now - lo) / height : 0;
  return out;
}

/** IS HE RIDING AT ALL — the half of the question that needs no sea read:
 * the hull on the water and making way (`TUNING.tricks.riding`). It is what
 * separates riding from floating, and a trick turned on the water needs it
 * whichever trick it is, so the laydown asks it too. Asked FIRST, because
 * the answer is free and the sweep below is nine samples of the sea. */
export function underWay(craft: CraftState): boolean {
  return !craft.airborne && Math.abs(craft.way) >= T.riding;
}

/** ...and IS HE RIDING THE CREST: a wave with something to it
 * (`waveHeight`) and the hull in the top of it (`waveCrest`, or `waveHold`
 * for a ride already running — the band has depth so a hull hunting either
 * side of one line is one ride and not forty).
 *
 * There is no term here for "along the wave", and there does not need to
 * be: holding the top IS riding along it. A hull run along a crest holds
 * it for three to five seconds, one run with the wave for about two, and
 * one driven across the sea for half of one, so the rule measures the
 * RESULT and never the heading — which is the engine's habit everywhere. */
export function ridingCrest(craft: CraftState, wave: WaveUnder, already: boolean): boolean {
  if (!underWay(craft)) return false;
  if (wave.height < T.waveHeight) return false;
  return wave.share >= (already ? T.waveHold : T.waveCrest);
}
