// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SEASONS a level can be ridden in, and when in the year each one falls.
//
// The sun's geometry — an hour, a latitude and a declination in, an
// elevation and a bearing out — is textbook and nothing of this game's, so
// it is the framework's (`@niclaslindstedt/oss-game-framework/core/solar`).
// WHICH declination a season stands for is a fact about this game's coasts
// and stays here: the level generator deals a season (R13), the biomes date
// their own seasons against this table, and `sunAt` is handed the result.

/** The four seasons a level can be ridden in, in the year's order. */
export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export type Season = (typeof SEASONS)[number];

/**
 * THE SUN'S DECLINATION in the middle of each season, degrees.
 *
 * The seasons are the METEOROLOGICAL ones, as a northern weather service
 * defines them — by the daily mean temperature crossing 0 °C and 10 °C for
 * a run of days, so their dates are a fact about a place. On the taiga
 * coast at 62°N the normals put spring's arrival in early April, summer's
 * in early June, autumn's around the middle of September and winter's in
 * early November, and each season's declination here is the sun's on the
 * middle day of that season on that coast:
 *
 *   spring   early May (+16°)   — the ice just gone out of the bays; the
 *                                 day sixteen hours, the night a nautical
 *                                 twilight that never reaches full dark
 *   summer   late July (+20°)   — an eighteen-hour day, and a night that
 *                                 bottoms out eight degrees under: a deep
 *                                 blue dusk with the brightest stars in
 *                                 it, never black. (At the solstice itself
 *                                 the sun stops 4.6° under and the night is
 *                                 civil twilight throughout.)
 *   autumn   early October (−7°) — an eleven-hour day, the sun 24° up at
 *                                 noon, and a night that goes thirty
 *                                 degrees under: astronomical dark, the
 *                                 Milky Way out, the moon the only light
 *   winter   mid-November (−19°) — a six-and-a-half-hour day with the sun
 *                                 nine degrees up at noon, up at half past
 *                                 eight and gone by half past three, and
 *                                 the longest night of the four
 *
 * WINTER IS NOVEMBER, NOT JANUARY, because the sea is open in November and
 * not in January: a brackish northern sea's ice season normally runs from the
 * start of December to the middle of May, and in all but a mild winter
 * most of the sea freezes, coasts first. The middle weeks of meteorological
 * winter before the ice are the only winter water a craft can be ridden on
 * here, so those are the weeks the season is dated to. The same ice is why
 * spring is dated to May rather than to the season's April start.
 *
 * Astronomical night — the sun eighteen degrees under — is impossible at
 * this latitude from late April to the middle of August, which is why the
 * spring and summer nights above never get to it and the autumn and winter
 * ones always do. All of it comes out of this one table.
 */
export const DECLINATION: Record<Season, number> = {
  spring: 16.1,
  summer: 20.0,
  autumn: -7.0,
  winter: -19.1,
};
