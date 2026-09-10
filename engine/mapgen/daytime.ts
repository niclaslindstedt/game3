// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TIMES OF DAY A LEVEL CAN BE RIDDEN AT (R13) — the three hours a rider
// is offered, worked out from the coast's OWN daylight rather than written
// down as numbers.
//
// That is the whole reason this is engine-side. R13 gives every level a
// daylight window off its biome's latitude and its own season — the taiga's
// 62° puts midsummer sunrise at about 02:22 and sunset at about 21:38, and
// December's at 10:00 and 14:00 — so "sunrise" is a fact about the place
// and the day, not a constant. Three hours hard-coded in the app would be
// three hours that are right for exactly one coast in one season, and
// silently wrong for the first one added after it.
//
// The window is the sun's crossings of `day.minSun`, which is the horizon:
// its two ends are the sun exactly ON it. Riding there is a sun with no
// elevation at all, so each end is INSET by `EDGE` of the window — far
// enough in that the sun is properly up and the light has a colour, near
// enough out that it is unmistakably the low, long-shadowed end of the day.
// And the clock runs on from there (`sunHourAt`): a SUNSET start is a run
// that rides into the dark.

import { DECLINATION, daylightWindow } from "../lib/solar.ts";
import { biomeOf } from "./biomes.ts";
import { LEVEL_RULES as R } from "./rules.ts";
import type { Level } from "./types.ts";

/** Every hour a rider may ask for, earliest first. */
export const TIMES_OF_DAY = ["sunrise", "day", "sunset"] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

/** How far in from each end of the daylight window the low hours stand, as
 * a fraction of the window. A twentieth of a nineteen-hour midsummer taiga
 * day is about fifty minutes — the sun a few degrees up, which is the light
 * the word "sunrise" is actually asking for — and a twentieth of its
 * four-hour December day is twelve, which is the same light. */
const EDGE = 0.05;

/**
 * The hour on the clock a named time of day is, on THIS coast.
 *
 * Midday is the middle of the window rather than 12:00 flat: the two are
 * the same on a level coast and the window is what the other two are
 * measured against, so reading all three off one span keeps them ordered
 * however the window sits. The window is the level's own SEASON's.
 */
export function hourOfDay(level: Pick<Level, "biome" | "season">, when: TimeOfDay): number {
  const window = daylightWindow(
    biomeOf(level.biome).latitude,
    R.day.minSun,
    DECLINATION[level.season],
  );
  // A coast in the midnight sun has no crossings and `daylightWindow` hands
  // back the whole clock; the arithmetic below is still the right answer
  // there — midnight, noon and midnight again.
  const { min, max } = window ?? { min: 0, max: 24 };
  const span = max - min;
  switch (when) {
    case "sunrise":
      return min + span * EDGE;
    case "sunset":
      return max - span * EDGE;
    default:
      return min + span / 2;
  }
}

/**
 * The named hour a level was DEALT: the rung of {@link TIMES_OF_DAY} its own
 * hour (R13) stands nearest to on this coast.
 *
 * The inverse of {@link hourOfDay}, and engine-side for the same reason that
 * one is: the three hours are facts about the PLACE, so which of them a dealt
 * hour belongs to cannot be read off the number alone. The start card asks,
 * so that its three chips can say which hour the seed already gives.
 */
export function dealtTimeOfDay(level: Pick<Level, "biome" | "season" | "hour">): TimeOfDay {
  let nearest: TimeOfDay = TIMES_OF_DAY[0];
  let gap = Infinity;
  for (const when of TIMES_OF_DAY) {
    const from = Math.abs(level.hour - hourOfDay(level, when));
    if (from < gap) {
      gap = from;
      nearest = when;
    }
  }
  return nearest;
}
