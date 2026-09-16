// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LEVEL THE SETTINGS ASK FOR — the one place the game's stored choices
// and the URL's overrides become a `GenerateOptions`, and the one place the
// generator's REFUSAL becomes an answer rather than an exception.
//
// It sits beside `run-loader.ts` because it is the other half of standing a
// run up: that module owns the SEQUENCING of the work, this one owns what
// the work is asked to build. Neither knows the other exists.
//
// Two callers, and the difference between them is the whole reason `tryGame`
// is here. The attract sea behind every card has to exist for the page to
// mount at all, so a refusal there falls back. A run the player asked for
// must never fall back — riding a different shore from the one on the card
// is a lie — so its refusal is reported to their face (`loading-screen.tsx`).

import { createGame, warn, type GameState } from "@engine";

import { CONDITION_DAY, DEFAULT_SEED, type Settings } from "./settings.ts";
import type { Params } from "./url-params.ts";

/** What the URL alone decides about the level. Both are the LEVEL's own —
 * exact figures that say what it IS, the way the seed does — which is why
 * neither is a setting and nothing on a menu writes one. */
export type LevelParams = Pick<Params, "hour" | "track">;

/** Which seed and which sea the settings currently ask for. Called at the
 * moment a run is stood up rather than captured, so a seed changed on the
 * developer page is the seed START rides.
 *
 * THROWS when the generator refuses the seed — see `tryGame`. */
export function gameFor(s: Settings, params: LevelParams): GameState {
  // The start card's WIND row is two of these at once: the wind that builds
  // the sea, and the sky that belongs over that wind (R19 keeps the pair
  // honest, and `CONDITION_DAY` is where the rung becomes both).
  const day = s.ride.conditions === null ? null : CONDITION_DAY[s.ride.conditions];
  return createGame({
    seed: s.ride.seed ?? DEFAULT_SEED,
    biome: s.ride.biome,
    craft: s.ride.craft,
    // THE MODE, and the length a tricks run was asked for, seconds.
    mode: s.ride.mode,
    limit: s.ride.tricksMinutes * 60,
    // R32 — the CLASS: the hull is derived at it and the COURSE is paced
    // for it, so the same seed in two classes is two different races.
    speedClass: classFor(s),
    track: params.track,
    // The developer's own rows win where they are set: they are the exact
    // figure, and the card's is a word standing for one.
    windSpeed: s.dev.wind ?? day?.wind,
    // R36 — the sea standing off the coast, which the WIND row above does
    // not imply and cannot ask for. Left alone it is the shore's own.
    swell: s.ride.swell ?? undefined,
    sea: s.dev.hs !== null ? { hs: s.dev.hs } : undefined,
    hour: params.hour,
    timeOfDay: s.ride.time ?? undefined,
    season: s.ride.season ?? undefined,
    // The WEATHER row wins over the sky its wind implies — that is the whole
    // of what it is for. Left alone (null) it defers, and the pair stays the
    // one R19 would have dealt.
    weather: s.ride.weather ?? day?.weather,
  });
}

/** THE CLASS A RUN IS RIDDEN AT: the rider's own, except in a TRICKS run,
 * which is stock only — a score is compared across riders, and a class that
 * throws the hull higher off every lip would make the row the score. The
 * craft card reads this too, so the sheet says what the water does. */
export function classFor(s: Settings): number {
  return s.ride.mode === "tricks" ? 1 : s.ride.speedClass;
}

/** The same level, or null where the generator REFUSED the seed.
 *
 * A seed with no clean coast on it is a bounded search that ran out
 * (`generateLevel` tries a fixed number of sub-seeds and rejects every one
 * of them on the analyzer's verdict), not a crash — the number is simply
 * not a shore, and the next one along will be. It is rare and it is real:
 * about one seed in a hundred on a coast, and the app has to stay a game
 * when it happens. */
export function tryGame(s: Settings, params: LevelParams): GameState | null {
  try {
    return gameFor(s, params);
  } catch (e) {
    warn(`the generator refused this shore: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/** The shore the game SHIPS WITH, on the coast the settings name — what the
 * attract sea falls back to when the stored seed has none.
 *
 * Deliberately the plainest call this module can make: the point of a
 * fallback is that it builds, so it carries none of the rows (a forced
 * weather, a developer's wind, a speed class) that narrowed the search the
 * stored seed failed. */
export function fallbackGame(s: Settings): GameState {
  return createGame({ seed: DEFAULT_SEED, biome: s.ride.biome });
}
