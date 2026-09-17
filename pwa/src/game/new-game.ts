// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LEVEL THE SETTINGS ASK FOR — the one place the game's stored choices
// and the URL's overrides become a `GenerateOptions`, and the one place the
// generator's REFUSAL becomes an answer rather than an exception.
//
// It sits beside `run-loader.ts` because it is the other half of standing a
// run up: that module owns the SEQUENCING of the work, this one owns what
// the work is asked to build. Neither knows the other exists.
//
// TWO KINDS OF LEVEL COME OUT OF IT. A measured run — a race, a tricks run,
// a time trial — is ridden on one of the campaign's PINNED shores,
// chosen on `menu-levels.tsx` and carrying its own day, so nothing on this
// module's free-ride path is read at all. Everything else builds the seed
// the settings and the URL between them name: the FREE ride, the attract
// sea under every card, and every lab's `?seed=` link.
//
// Two callers, and the difference between them is the whole reason `tryGame`
// is here. The attract sea behind every card has to exist for the page to
// mount at all, so a refusal there falls back. A run the player asked for
// must never fall back — riding a different shore from the one on the card
// is a lie — so its refusal is reported to their face (`loading-screen.tsx`).

import { createGame, warn, type CraftId, type GameState, type Level } from "@engine";

import { levelForMode, pinnedGame, shoreOf, type CampaignLevel } from "./campaign.ts";
import type { RecordKey } from "./records.ts";
import { DEFAULT_SEED, skyForWind, type Settings } from "./settings.ts";
import type { Params } from "./url-params.ts";

/** What the URL alone decides about the level. The hour and the track are
 * the LEVEL's own — exact figures that say what it IS, the way the seed
 * does — which is why neither is a setting and nothing on a menu writes
 * one. The rest are THE DAY, which on a measured run no row offers
 * (`dayFor`): a link may still name one, because that is how the labs
 * photograph a shore under a chosen sky. */
export type LevelParams = Pick<
  Params,
  "hour" | "track" | "time" | "season" | "day" | "waves" | "weather"
>;

/** THE DAY A RUN IS RIDDEN IN — the sky, the season, the hour's name, the
 * wind and the sea outside. On a FREE ride they are the card's rows, in the
 * rider's own figures. Otherwise they are the SHORE'S OWN: a time on a
 * level is a time on the day that level deals, so no card offers them, and
 * what is left is the URL's word for the labs. (A run on a PINNED shore
 * never reaches here at all — its day is the level's, and `pinnedGame`
 * states it.) */
function dayFor(
  s: Settings,
  params: LevelParams,
): Pick<Settings["ride"], "time" | "season" | "wind" | "swell" | "weather"> {
  if (freeRides(s)) return s.ride;
  return {
    time: params.time ?? null,
    season: params.season ?? null,
    wind: params.day ?? null,
    swell: params.waves ?? null,
    weather: params.weather ?? null,
  };
}

/** THE SAME RUN ON ANOTHER HULL, over a shore somebody has already built.
 * A GHOST is stood up with both (`ghost-run.ts`): it rides the craft the
 * figure was set on rather than the one the card is showing, and it is
 * handed the level object the run beside it is on — building one is the
 * most expensive thing this engine does, and that shore has been paid for
 * already. */
export type RunOver = { level?: Level; craft?: CraftId };

/** THE PINNED SHORE this run is on, or null where it is choosing its own.
 *
 * RACE, TRICKS and TIME TRIAL ride one of the campaign's pinned levels
 * rather than a seed (`menu-levels.tsx`), so what they are riding is a
 * LEVEL ID and the day comes with it. Three answers are null: a FREE ride,
 * which is the mode that picks a seed; an id the ladder no longer has or
 * that this mode cannot ride (`fitsMode`); and a run with no id at all,
 * which is a fresh app or a link that named a seed. */
export function pinnedFor(s: Settings): CampaignLevel | null {
  return levelForMode(s.ride.level, s.ride.mode);
}

/** WHAT NAMES THIS RUN'S ROW in the record book: the level as the settings
 * and the URL stood it up (`records.ts` says what is deliberately left
 * out). A PINNED SHORE names itself — its coast, its seed and its track are
 * the level's rather than the rows', which is what makes two riders' times
 * down the same rung the same figure.
 *
 * It sits beside `gameFor` because it is the same question asked twice:
 * that one turns the settings into the run, this one turns them into the
 * row the run's figure goes in, and a book keyed off anything the run was
 * not actually ridden on is a book of figures nobody can compare. */
export function recordKeyFor(s: Settings, track: RecordKey["track"] | undefined): RecordKey {
  const pinned = pinnedFor(s);
  return {
    mode: s.ride.mode,
    biome: pinned ? shoreOf(pinned).id : s.ride.biome,
    seed: pinned ? pinned.seed : (s.ride.seed ?? DEFAULT_SEED),
    track: pinned ? pinned.track : (track ?? "coast"),
    speedClass: classFor(s),
    minutes: s.ride.tricksMinutes,
  };
}

/** How long the clock gives this run, seconds — a tricks run's LENGTH row,
 * and nothing at all for the modes ridden to a finish line. */
function limitFor(s: Settings): number {
  return s.ride.mode === "tricks" ? s.ride.tricksMinutes * 60 : 0;
}

/** Which seed and which sea the settings currently ask for. Called at the
 * moment a run is stood up rather than captured, so a seed changed on the
 * developer page is the seed START rides.
 *
 * THROWS when the generator refuses the seed — see `tryGame`. */
export function gameFor(s: Settings, params: LevelParams, over?: RunOver): GameState {
  // A PINNED SHORE ANSWERS EVERYTHING BELOW: the seed, the track, the day
  // and the sea are the level's own, so none of the rows or the URL's words
  // are read at all. The field is the MODE's (`MODE_RULES`) rather than the
  // campaign's, which is the whole difference between this and a rung.
  const pinned = pinnedFor(s);
  if (pinned) {
    return pinnedGame(pinned, s.ride.mode, over?.craft ?? s.ride.craft, {
      limit: limitFor(s),
      built: over?.level,
    });
  }
  // The WIND row is two things at once: the wind that builds the sea, and
  // the sky that belongs over that wind (R19 keeps the pair honest, and
  // `skyForWind` is where the figure becomes both). Outside a free ride
  // the day is the shore's own and a link's (`dayFor`), so a 33 m/s gale
  // set for fun never follows the rider into a time trial.
  const day = dayFor(s, params);
  const wind = day.wind;
  return createGame({
    seed: s.ride.seed ?? DEFAULT_SEED,
    biome: s.ride.biome,
    craft: over?.craft ?? s.ride.craft,
    // The shore, where one is handed in: everything below that describes
    // how a level is BUILT is then read by nobody.
    level: over?.level,
    // THE MODE, and the length a tricks run was asked for, seconds.
    mode: s.ride.mode,
    limit: limitFor(s),
    // R32 — the CLASS: the hull is derived at it and the COURSE is paced
    // for it, so the same seed in two classes is two different races.
    speedClass: classFor(s),
    track: params.track,
    // The developer's own rows win where they are set: they are the exact
    // figure, and the card's is a word standing for one.
    windSpeed: s.dev.wind ?? wind ?? undefined,
    // ...and WHICH WAY it blows, which on a FREE ride is not a question:
    // dead onshore, always (`quarterOf`).
    windQuarter: quarterOf(s),
    // R36 — the sea standing off the coast, which the WIND row above does
    // not imply and cannot ask for. Left alone it is the shore's own.
    swell: day.swell ?? undefined,
    sea: s.dev.hs !== null ? { hs: s.dev.hs } : undefined,
    hour: params.hour,
    timeOfDay: day.time ?? undefined,
    season: day.season ?? undefined,
    // The WEATHER row wins over the sky its wind implies — that is the whole
    // of what it is for. Left alone (null) it defers, and the pair stays the
    // one R19 would have dealt.
    weather: day.weather ?? (wind === null ? undefined : skyForWind(wind)),
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

/** The quarter the wind is asked to blow from, rad off dead onshore — ZERO
 * on a free ride, and nothing at all anywhere else, where the level rides
 * the quarter R12 dealt it.
 *
 * Zero is straight in off the open water, which is to say square on to the
 * average line of the shore (`Level.seaHeading`, and `windQuarter` in
 * `engine/game/wind.ts` is what it is measured against). FREE used to offer
 * the angle as a fader and it was the one row on the card that could undo
 * the two above it: the quarter is what the fetch is measured along, so a
 * wind turned off the sea has no water at its back and grows nothing,
 * leaving a rider who asked for forty metres a second and a twenty-metre
 * swell on flat water with no row saying which one had cancelled the other.
 * The sea a free ride asks for is the sea it gets, so the wind is always at
 * the fetch's back and the WIND and WAVES rows mean what they say. */
function quarterOf(s: Settings): number | undefined {
  return freeRides(s) ? 0 : undefined;
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
