// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE SUN IS — textbook solar geometry, and nothing of this game in
// it. An hour and a latitude go in; an elevation and a bearing come out.
//
// It sits in the generic pool because two very different callers need the
// same arithmetic and must not each keep a copy of it: the LEVEL GENERATOR
// asks which hours of the day are ridden in daylight before it draws one
// (R13), and the app's sky asks how high the sun stands at the hour that
// was drawn. A second implementation of a cosine is a second implementation
// of sunset.
//
// ANGLES: the elevation is radians above the horizon, negative under it.
// The bearing is a WORLD HEADING in the engine's own convention — 0 along
// +z, growing clockwise toward +x — so +z is north and the south the sun
// crosses at noon is `SOUTH`.

const DEG = Math.PI / 180;

/** The world heading of due south — where the sun stands at solar noon on
 * any coast north of the tropics. */
export const SOUTH = Math.PI;

/** The sun's declination at the June solstice, degrees. The game is a
 * northern SUMMER — the water is 8–18 °C and the shore is in leaf — so the
 * season is a constant rather than a second clock nobody asked to set. */
export const SUMMER_DECLINATION = 23.4;

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
 * north. The hour angle runs 15° an hour either side of noon, and the
 * elevation and the azimuth fall out of it with the latitude and the
 * declination.
 */
export function sunAt(hour: number, latitude: number, declination = SUMMER_DECLINATION): SunPlace {
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
  declination = SUMMER_DECLINATION,
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
  declination = SUMMER_DECLINATION,
): { min: number; max: number } | null {
  const noon = sunAt(12, latitude, declination).elevation;
  if (noon < minElevation) return null;
  const up = hourOfElevation(minElevation, true, latitude, declination);
  const down = hourOfElevation(minElevation, false, latitude, declination);
  if (up === null || down === null) return { min: 0, max: 24 };
  return { min: up, max: down };
}
