// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HOW HARD IT IS COMING DOWN — the numbers everything wet is scaled by, and
// all of them are read off the WIND rather than invented.
//
// The engine seeds a mean wind inside R12's band and then breathes gusts
// around it (`TUNING.wind`), which is exactly the shape weather has: a level
// is heavier or lighter than its neighbours, and inside one level the rain
// arrives in squalls. Taking both from the wind means the sky, the sheet of
// rain, the sea running under the hull and the gust shoving the craft
// sideways are all telling the rider about the same weather — and that the
// same seed always brings the same weather back.
//
// DOM-free and three-free on purpose: `rain.ts` is a renderer module and the
// tests read the whole model without standing a renderer up.

import { TUNING, type Weather } from "@engine";

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** HOW MUCH WATER EACH SKY PUTS IN THE AIR, 0..1, at its lightest and at its
 * heaviest (read against `skyCover`).
 *
 * Rain is deliberately a good way past half at its lightest: drizzle is not
 * a weather this game has, and a level billed as rain that shows a few
 * scratches on the lens is worse than no weather at all. The two DRY skies
 * are exactly zero, not almost — an overcast lid with a stray drop under it
 * is the fault that makes a player stop believing any of it. */
const FALL: Record<Weather, [number, number]> = {
  clear: [0, 0],
  high: [0, 0],
  overcast: [0, 0],
  rain: [0.55, 0.85],
  squall: [0.8, 1],
};

/** HOW HARD THIS LEVEL'S SKY RAINS, 0..1 — its weather read at its own
 * cover. The standing rate, decided once per level; `squallOf` is the half
 * that breathes. */
export function fallOf(weather: Weather, cover: number): number {
  const [lo, hi] = FALL[weather];
  return lo + (hi - lo) * clamp01(cover);
}

/**
 * HOW HARD IT IS COMING DOWN RIGHT NOW, 0..1 of the level's own downpour.
 *
 * A squall IS a gust: the downdraught that carries the water is the
 * downdraught that shoves the hull. So this is the live gust factor the wind
 * is already breathing (`WindState.gust`, a multiple of the mean) read
 * against the band `TUNING.wind` allows it — which means the sheet thickens
 * exactly as the craft is pushed, for free and in step.
 */
export function squallOf(gust: number): number {
  const { gustMin, gustMax } = TUNING.wind;
  return gustMax > gustMin ? clamp01((gust - gustMin) / (gustMax - gustMin)) : 0.5;
}

/** WHAT IS LEFT OF THE VIEW at the height of a downpour — the share of the
 * fog's own reach that survives. Water in a column of air greys the distance
 * and takes the far shore; a rider can still see the next gate, which is
 * what keeps a wet level rideable. */
const VEIL = 0.6;

/**
 * HOW FAR THE VIEW RUNS THROUGH WHAT IS FALLING, as a share of the fog's own
 * reach — 1 in still air, down to `VEIL` at the height of a squall.
 *
 * The weather LOOK already shortens the fog for the sky it is under
 * (`fogNear`/`fogFar` in sky-looks.ts): that is the level's own standing
 * weather, decided once. This is the half that BREATHES — the squall riding
 * through, thickening the sheet and taking the distance with it — and it is
 * what makes a downpour read as rain from the far end of the frame rather
 * than only as streaks in front of the lens. The two compound: a squall
 * level is short to begin with and closes right in when the gust arrives.
 */
export function precipReach(fall: number): number {
  return 1 - (1 - VEIL) * clamp01(fall);
}
