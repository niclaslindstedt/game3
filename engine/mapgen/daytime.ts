// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TIMES OF DAY A LEVEL CAN BE RIDDEN AT (R13) — the four hours a rider
// is offered, worked out from the coast's OWN daylight rather than written
// down as numbers.
//
// That is the whole reason this is engine-side. R13 gives every level a
// daylight window off its biome's latitude and its own season — the taiga's
// 62° puts midsummer sunrise at about 02:22 and sunset at about 21:38, and
// December's at 10:00 and 14:00 — so "sunrise" is a fact about the place
// and the day, not a constant. Hours hard-coded in the app would be hours
// that are right for exactly one coast in one season, and silently wrong
// for the first one added after it.
//
// The window is the sun's crossings of `day.minSun`, which is the horizon:
// its two ends are the sun exactly ON it. Riding there is a sun with no
// elevation at all, so each end is INSET by `EDGE` of the window — far
// enough in that the sun is properly up and the light has a colour, near
// enough out that it is unmistakably the low, long-shadowed end of the day.
// And the clock runs on from there (`sunHourAt`): a SUNSET start is a run
// that rides into the dark.
//
// NIGHT IS THE ONE RUNG OUTSIDE THAT WINDOW, and it is the only one R13
// cannot deal: the generator draws its hour from inside the daylight so a
// run never STARTS in the dark, and the three daylight rungs are the ones a
// seed's own hour can ever be named as. The rider may ask for it all the
// same, which is what this rung is — the deep night the sun ladder already
// draws for anybody who rides a SUNSET start long enough (the stars, the
// moon's key, the craft's lamp on the water), reached from the first frame
// instead of ten minutes in. It is midday's OPPOSITE rather than a fourth
// figure, so it comes off the same window as the rest and costs no new
// astronomy.

import { DECLINATION, daylightWindow } from "../lib/solar.ts";
import { biomeOf } from "./biomes.ts";
import { LEVEL_RULES as R } from "./rules.ts";
import type { Level } from "./types.ts";

/** Every hour a rider may ask for, in the order a run passes through them:
 * first light, midday, last light, then the dark. That is the LADDER the
 * start card's pips draw, which is why `night` is last rather than first —
 * it stands at midnight on the clock, but a rider reads TIME as the arc of
 * a day and the dark is where that arc ends. */
export const TIMES_OF_DAY = ["sunrise", "day", "sunset", "night"] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

/** How far in from each end of the daylight window the low hours stand, as
 * a fraction of the window. A twentieth of a nineteen-hour midsummer taiga
 * day is about fifty minutes — the sun a few degrees up, which is the light
 * the word "sunrise" is actually asking for — and a twentieth of its
 * four-hour December day is twelve, which is the same light. */
const EDGE = 0.05;

/**
 * The hour on the clock a named time of day is, on THIS coast — 0..24.
 *
 * Midday is the middle of the window rather than 12:00 flat: the two are
 * the same on a level coast and the window is what the other three are
 * measured against, so reading all four off one span keeps them ordered
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
  // there — midnight, noon and midnight again, the last of them a sun that
  // never went down. There is no night to offer at such a coast, and this
  // hands back its darkest hour rather than pretending one.
  const { min, max } = window ?? { min: 0, max: 24 };
  const span = max - min;
  const midday = min + span / 2;
  switch (when) {
    case "sunrise":
      return min + span * EDGE;
    case "sunset":
      return max - span * EDGE;
    case "night":
      // The middle of the DARK, which is half a day round the clock from
      // the middle of the light: the night runs from `max` to `min + 24`,
      // and its midpoint is `midday + 12` however the window sits. Deriving
      // it keeps the rung honest the day a coast's noon is not 12:00 — and
      // asking for the middle rather than an inset end is what makes it the
      // rung it is, the sun at its lowest and the stars fully out.
      return (midday + 12) % 24;
    default:
      return midday;
  }
}

/** How far apart two hours are ON A CLOCK — never more than twelve, because
 * the dial wraps. Midnight is an hour from 23:00, not twenty-three. */
function hoursApart(a: number, b: number): number {
  const gap = Math.abs((((a - b) % 24) + 24) % 24);
  return Math.min(gap, 24 - gap);
}

/**
 * The named hour a level was DEALT: the rung of {@link TIMES_OF_DAY} its own
 * hour (R13) stands nearest to on this coast.
 *
 * The inverse of {@link hourOfDay}, and engine-side for the same reason that
 * one is: the hours are facts about the PLACE, so which of them a dealt hour
 * belongs to cannot be read off the number alone. The start card asks, so
 * that its row can mark the hour the seed already gives.
 *
 * A GENERATED level never answers `night`: R13 draws its hour from inside
 * the daylight window, and every hour in there is nearer one of the three
 * daylight rungs than it is to midnight. So the night rung is always an
 * override on the card, never the mark — which is the honest reading, since
 * no seed is dealt one.
 */
export function dealtTimeOfDay(level: Pick<Level, "biome" | "season" | "hour">): TimeOfDay {
  let nearest: TimeOfDay = TIMES_OF_DAY[0];
  let gap = Infinity;
  for (const when of TIMES_OF_DAY) {
    // On a CLOCK, so that 23:00 is an hour from the night rung rather than
    // twenty-three from it — the question only has an answer once a rung
    // sits at midnight with the other three on the far side of it.
    const from = hoursApart(level.hour, hourOfDay(level, when));
    if (from < gap) {
      gap = from;
      nearest = when;
    }
  }
  return nearest;
}
