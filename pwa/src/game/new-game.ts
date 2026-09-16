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

import { DEFAULT_SEED, seaStateFor, skyForWind, windAsRung, type Settings } from "./settings.ts";
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
  // The start card's WIND row is two things at once: the wind that builds
  // the sea, and the sky that belongs over that wind (R19 keeps the pair
  // honest, and `skyForWind` is where the figure becomes both).
  //
  // A MEASURED RUN ONLY EVER RIDES WHAT ITS OWN ROW CAN SAY. One field
  // carries both kinds of answer — a rung the worded card pressed and
  // whatever a free ride's fader was left on — so outside a free ride the
  // figure is put back on the ladder it came from. A 33 m/s gale set for fun
  // must not follow the rider into a time trial under a row standing on
  // nothing; on the free ride itself, the figure is the answer.
  const free = freeRides(s);
  const wind = s.ride.wind === null ? null : free ? s.ride.wind : windAsRung(s.ride.wind);
  const swell = s.ride.swell === null ? undefined : free ? s.ride.swell : seaStateFor(s.ride.swell);
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
    windSpeed: s.dev.wind ?? wind ?? undefined,
    // ...and WHICH WAY it blows, FREE's row alone (`freeRides`): rad off
    // dead onshore, which the row keeps in degrees because that is what a
    // person reads. Left alone it is the quarter R12 dealt.
    windQuarter: quarterOf(s),
    // R36 — the sea standing off the coast, which the WIND row above does
    // not imply and cannot ask for. Left alone it is the shore's own.
    swell,
    sea: s.dev.hs !== null ? { hs: s.dev.hs } : undefined,
    hour: params.hour,
    timeOfDay: s.ride.time ?? undefined,
    season: s.ride.season ?? undefined,
    // The WEATHER row wins over the sky its wind implies — that is the whole
    // of what it is for. Left alone (null) it defers, and the pair stays the
    // one R19 would have dealt.
    weather: s.ride.weather ?? (wind === null ? undefined : skyForWind(wind)),
  });
}

/** WHETHER THIS RUN IS A FREE ONE — the mode with nothing asked of the
 * rider, and so the only one allowed the knobs the generator would not deal
 * itself: a speed class, a wind off any quarter, a sea of any size. Asked
 * here rather than compared to a string in four surfaces, so the day a
 * second such mode exists there is one line to change. */
export function freeRides(s: Settings): boolean {
  return s.ride.mode === "free";
}

/** The quarter the wind is asked to blow from, rad off dead onshore, or
 * nothing where the level's own is being ridden. Degrees on the row and in
 * the stored blob; radians is what the engine speaks. */
function quarterOf(s: Settings): number | undefined {
  if (!freeRides(s) || s.ride.windQuarter === null) return undefined;
  return (s.ride.windQuarter * Math.PI) / 180;
}

/** THE CLASS A RUN IS RIDDEN AT: STOCK, unless the run is a FREE one.
 *
 * Every other mode is measured — a time on a shore, a score off its ramps —
 * and a class is not a difficulty setting: it derives a faster hull AND
 * paces the course for it (R32), so two riders at two classes are not riding
 * the same race and their figures are not the same figure. The record book
 * keys on the class for exactly that reason, which kept the rows honest but
 * left the front door offering four ladders of the same race with no reason
 * to choose between them. So the ladder lives where nothing is compared:
 * FREE. It comes back to the measured modes the day the game has somebody to
 * measure a rider AGAINST — a field of human riders who agreed on a class.
 *
 * The craft card reads this too, so the sheet says what the water does. */
export function classFor(s: Settings): number {
  return freeRides(s) ? s.ride.speedClass : 1;
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
