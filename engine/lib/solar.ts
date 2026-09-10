// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE SUN IS — textbook solar geometry, and nothing of this game in
// it. An hour, a latitude and a season go in; an elevation and a bearing
// come out.
//
// It sits in the generic pool because two very different callers need the
// same arithmetic and must not each keep a copy of it: the LEVEL GENERATOR
// asks which hours of the day are ridden in daylight before it draws one
// (R13), and the app's sky asks how high the sun stands at the hour the
// run has reached. A second implementation of a cosine is a second
// implementation of sunset.
//
// ANGLES: the elevation is radians above the horizon, negative under it.
// The bearing is a WORLD HEADING in the engine's own convention — 0 along
// +z, growing clockwise toward +x — so +z is north and the south the sun
// crosses at noon is `SOUTH`.

const DEG = Math.PI / 180;

/** The world heading of due south — where the sun stands at solar noon on
 * any coast north of the tropics. */
export const SOUTH = Math.PI;

/** The four seasons a level can be ridden in, in the year's order. */
export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export type Season = (typeof SEASONS)[number];

/**
 * THE SUN'S DECLINATION in the middle of each season, degrees.
 *
 * The seasons are the METEOROLOGICAL ones, as the Swedish weather service
 * defines them — by the daily mean temperature crossing 0 °C and 10 °C for
 * a run of days, so their dates are a fact about a place. On the Bothnian
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
 * not in January: the Bothnian Sea's ice season normally runs from the
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

export type SunPlace = {
  /** Radians above the horizon; negative under it. */
  elevation: number;
  /** World heading the sun stands at (see `SOUTH`). */
  azimuth: number;
  /** Whether it is on its way up — before solar noon. */
  rising: boolean;
  /** The hour it was read at, 0..24. */
  hour: number;
};

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * WHERE THE SUN IS at `hour` (solar time, 0..24) at `latitude` degrees
 * north, with the sun at `declination` degrees (`DECLINATION[season]`).
 * The hour angle runs 15° an hour either side of noon, and the elevation
 * and the azimuth fall out of it with the latitude and the declination.
 */
export function sunAt(hour: number, latitude: number, declination: number): SunPlace {
  const lat = latitude * DEG;
  const dec = declination * DEG;
  const h = ((((hour % 24) + 24) % 24) - 12) * 15 * DEG;
  const sinEl = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(h);
  const elevation = Math.asin(clamp(sinEl, -1, 1));
  // Azimuth measured from the south, positive toward the west — so it is
  // negative all morning and swings through zero at noon.
  const fromSouth = Math.atan2(
    Math.sin(h),
    Math.cos(h) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat),
  );
  return { elevation, azimuth: SOUTH + fromSouth, rising: h < 0, hour };
}

/** How finely the crossings below are searched, hours. A twentieth of an
 * hour is three minutes of clock and a few hundredths of a degree of arc;
 * the linear step between two samples closes the rest. */
const STEP = 1 / 20;

/**
 * The hour at which the sun stands at `elevation`, on its way up (`rising`)
 * or down — or null when it never reaches it that day. Both answers are
 * real: a midsummer night at 62°N never gets down to −8°, and no hour of it
 * gets up to +60°.
 */
export function hourOfElevation(
  elevation: number,
  rising: boolean,
  latitude: number,
  declination: number,
): number | null {
  const from = rising ? 0 : 12;
  let was = sunAt(from, latitude, declination).elevation - elevation;
  for (let h = from + STEP; h <= from + 12 + 1e-9; h += STEP) {
    const now = sunAt(h, latitude, declination).elevation - elevation;
    if ((rising && was < 0 && now >= 0) || (!rising && was > 0 && now <= 0)) {
      // The arc is a cosine, and a twentieth of an hour of it is straight.
      const f = was / (was - now);
      return h - STEP + f * STEP;
    }
    was = now;
  }
  return null;
}

/**
 * THE HOURS THIS COAST IS IN DAYLIGHT — the window between the morning and
 * evening crossings of `minElevation`, or null when the sun never reaches
 * it at all.
 *
 * A sun that is already over the floor at midnight (the midnight sun, and
 * on a high-summer coast it takes very little latitude) has no crossing to
 * find, and the whole clock is the window.
 */
export function daylightWindow(
  latitude: number,
  minElevation: number,
  declination: number,
): { min: number; max: number } | null {
  const noon = sunAt(12, latitude, declination).elevation;
  if (noon < minElevation) return null;
  const up = hourOfElevation(minElevation, true, latitude, declination);
  const down = hourOfElevation(minElevation, false, latitude, declination);
  if (up === null || down === null) return { min: 0, max: 24 };
  return { min: up, max: down };
}
