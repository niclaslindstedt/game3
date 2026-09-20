// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// OPTIONS ▸ VIDEO AS IT STANDS, IN WORDS — the six rows a rider actually
// turns, read back as `LABEL VALUE` pairs.
//
// It exists because a picture setting is stored as an id and read as a word,
// and two surfaces need the word rather than the id: the BENCHMARK's card
// prints what the picture was set to under the score it produced, and its
// score sheet draws each row as a rung on its own ladder
// (`benchmark-sheet.ts`). A score without its conditions is a number whose
// conditions live in somebody's memory of what they pressed, and the whole
// use of that tool is running it twice with one row moved.
//
// IT IS ITS OWN MODULE FOR TWO REASONS. `settings-video.ts` is the dictionary
// between a row and a draw call and deliberately carries no words (§39.1);
// `menu-options.tsx` has the words and cannot be imported by anything
// DOM-free. This is the join: DOM-free, so the tests read it, and the ONE
// place the three ladder steps are worded — the options page takes `STEPS`
// from here rather than keeping a second copy.
//
// `PICTURE_LADDERS` SITS INCHES FROM `pictureRows` on purpose. The first says
// what a row READS right now; the second says what it could ever have read,
// which is what anything decoding a stored row back into a POSITION needs.
// They are one list written twice and the cost of them disagreeing is silent:
// a row added to `pictureRows` alone still reports a value, and every stored
// run then draws it as "a stop this build does not have".
// `tests/benchmark_test.ts` walks every stop of every row through both.

import {
  DETAIL_LEVELS,
  DISTANCE_LEVELS,
  FRAME_RATE_LEVELS,
  REFLECTION_LEVELS,
  RESOLUTION_LEVELS,
  WATER_LEVELS,
  detailOf,
  type ReflectionLevel,
  type VideoSettings,
} from "./settings-video.ts";
import { STRINGS } from "./strings.ts";

/** The three steps every picture ladder is walked in, cheapest first. One set
 * of words for all four rows that use them — LOW on one row and MINIMAL on
 * the next would read as two different kinds of ladder — and the options page
 * builds its chips off this same record. */
export const STEPS: Record<"low" | "medium" | "high", string> = {
  low: STRINGS.optLow,
  medium: STRINGS.optMedium,
  high: STRINGS.optHigh,
};

/** THE PICTURE ROWS, NAMED ONCE. OPTIONS ▸ VIDEO sets them and the
 * benchmark's card reports what they were standing at, and the two have to
 * agree or a score cannot be mapped back onto the menu that produced it. */
export const PICTURE_ROWS = {
  water: STRINGS.optWater,
  resolution: STRINGS.optResolution,
  detail: STRINGS.optDetail,
  distance: STRINGS.optDistance,
  seeThrough: STRINGS.optSeeThrough,
  reflections: STRINGS.optReflections,
  frameRate: STRINGS.optFrameRate,
} as const;

/** One row, as it reads on screen. */
export type PictureRow = { label: string; value: string };

/** The SEE-THROUGH row's two stops, cheapest first: a solid sea is the cheap
 * picture, and the window over it is the dearest thing in the frame on a tile
 * GPU. */
const SEE_STOPS = [STRINGS.optOff, STRINGS.optOn] as const;

/** The REFLECTIONS row's stops, cheapest first — the sky alone, the near
 * coast's light smeared into the water, then the shore itself at two
 * sharpnesses. Exported for the same reason `STEPS` is: the options page
 * builds its chips off this record rather than keeping a second copy. */
export const MIRROR_STEPS: Record<ReflectionLevel, string> = {
  off: STRINGS.optOff,
  glow: STRINGS.optReflectGlow,
  soft: STRINGS.optReflectSoft,
  sharp: STRINGS.optReflectSharp,
};

/** The FRAME RATE row's stops, cheapest first — fewer frames is less work, so
 * the ladder climbs to the display's own rate. Worded as the figures they are,
 * which is how the row reads on the page. */
const RATE_STOPS: Record<(typeof FRAME_RATE_LEVELS)[number], string> = {
  "30": "30",
  "60": "60",
  max: STRINGS.optFrameRateMax,
};

/** What the picture is set to, in the rows the rider actually turns — every
 * value taken off the same stop list the menu walks, so the card and the menu
 * cannot drift into two vocabularies for one setting.
 *
 * DETAIL is the one row that is not stored: it is four levers
 * (`DETAIL_PRESETS`), and `detailOf` is what says which stop a set of them
 * IS. So a blob written on another build's ladder reports the picture it most
 * resembles rather than nothing at all. */
export function pictureRows(video: VideoSettings): PictureRow[] {
  return [
    { label: PICTURE_ROWS.water, value: STEPS[video.water] },
    { label: PICTURE_ROWS.resolution, value: STEPS[video.resolution] },
    { label: PICTURE_ROWS.detail, value: STEPS[detailOf(video)] },
    { label: PICTURE_ROWS.distance, value: STEPS[video.distance] },
    { label: PICTURE_ROWS.seeThrough, value: video.seeThrough ? STRINGS.optOn : STRINGS.optOff },
    { label: PICTURE_ROWS.reflections, value: MIRROR_STEPS[video.reflections] },
    { label: PICTURE_ROWS.frameRate, value: RATE_STOPS[video.frameRate] },
  ];
}

/** THE SAME ROWS AS LADDERS — every stop each one can report, cheapest first.
 *
 * A row carries a LIST of ladders rather than one because a stored run may
 * have been measured on a build whose row had different stops; a given run was
 * measured on one of them, so all are offered and the stored value picks.
 * Every row here has one today, and the shape is what lets a row gain a second
 * without every old run reading as unknown. */
export const PICTURE_LADDERS: { label: string; ladders: string[][] }[] = [
  { label: PICTURE_ROWS.water, ladders: [WATER_LEVELS.map((id) => STEPS[id])] },
  { label: PICTURE_ROWS.resolution, ladders: [RESOLUTION_LEVELS.map((id) => STEPS[id])] },
  { label: PICTURE_ROWS.detail, ladders: [DETAIL_LEVELS.map((id) => STEPS[id])] },
  { label: PICTURE_ROWS.distance, ladders: [DISTANCE_LEVELS.map((id) => STEPS[id])] },
  { label: PICTURE_ROWS.seeThrough, ladders: [[...SEE_STOPS]] },
  { label: PICTURE_ROWS.reflections, ladders: [REFLECTION_LEVELS.map((id) => MIRROR_STEPS[id])] },
  { label: PICTURE_ROWS.frameRate, ladders: [FRAME_RATE_LEVELS.map((id) => RATE_STOPS[id])] },
];
