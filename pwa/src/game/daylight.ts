// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE SUN IS — the one piece of astronomy the whole sky hangs off. A
// level is not ridden at "dusk"; it is ridden at 20:40 at 62°N, and dusk is
// what that turns out to be. Two facts decide the sun's place, and both are
// already the level's: the HOUR (R13) and the coast's LATITUDE (the biome's
// row). Nothing here is art-directed — the art direction is `sky.ts`'s,
// keyed on what comes out of here.
//
// The consequences are the point, and they are all real for this coast:
//
//   * the sun rises about 02:40 and sets about 21:20, so most hours on the
//     clock are ridden in daylight and the ones that are not are twilight;
//   * it never falls more than 4.6° under the horizon, so a midnight ride
//     is a blue civil twilight with the northern sky still glowing and the
//     brightest stars barely showing — the coast never gets a black night;
//   * a low sun stands in the NORTH at midnight and the north-east at three
//     in the morning, so where the light comes from is the hour's, and the
//     glow on the water moves round the rider over a long evening.
//
// THE SEASON IS FIXED at high summer (`DECLINATION`). The game is a northern
// summer — the water is 8–18 °C, the shore is in leaf — and a season dial
// would be a second clock nobody is asking to set. Where the sun is on a
// given DAY of that summer is the one thing this simplifies away.
//
// DOM-free and three-free on purpose: `sky.ts` reads it, and the tests read
// all of it without standing up a renderer.

const DEG = Math.PI / 180;

/** Which of the four kinds of light a moment is — the word for a sky,
 * for anything that keys on one rather than on a number. The sky itself
 * never reads it: the sky reads the elevation, and this is that elevation
 * binned. */
export type Daylight = "dawn" | "day" | "dusk" | "night";

/** Where the sun stands at solar noon, as a WORLD HEADING (the engine's
 * convention: 0 along +z, growing clockwise toward +x). The south — and on
 * this coast the shore runs south-west to north-east with the open sea on
 * its seaward side (R15), so a noon sun stands out over the water and an
 * evening one goes down the coast. */
export const SOUTH = Math.PI;

/** The sun's declination, degrees — the June solstice. See the header: one
 * season, fixed, and it is the one this coast is ridden in. */
export const DECLINATION = 23.4;

/** Below this the sun is NIGHT: the end of civil twilight, six degrees
 * under, radians — the point a real day stops being usable without a lamp.
 * Above `DAY_ABOVE` it is plain day; between the two the word is dawn or
 * dusk by which way the sun is going. */
export const NIGHT_BELOW = -6 * DEG;
export const DAY_ABOVE = 10 * DEG;

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
 * north. The textbook solar position: the hour angle runs 15° an hour
 * either side of noon, and the elevation and the azimuth fall out of it
 * with the latitude and the declination.
 */
export function sunAt(hour: number, latitude: number): SunPlace {
  const lat = latitude * DEG;
  const dec = DECLINATION * DEG;
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

/** The full moon's place — dead opposite the sun, which is what a full moon
 * IS: highest at solar midnight, and the key light of any sky dark enough
 * to need one. */
export function moonAt(sun: SunPlace): { elevation: number; azimuth: number } {
  return { elevation: -sun.elevation, azimuth: sun.azimuth + Math.PI };
}

/** The word for this much sun. */
export function daylightOf(sun: Pick<SunPlace, "elevation" | "rising">): Daylight {
  if (sun.elevation < NIGHT_BELOW) return "night";
  if (sun.elevation >= DAY_ABOVE) return "day";
  return sun.rising ? "dawn" : "dusk";
}

/**
 * HOW MUCH OF THE SUN a body `altitude` metres up still sees when the sun
 * is `elevation` radians off the horizon, 0..1.
 *
 * The horizon DIPS with height — by about √(2h/R) — so a cloud two
 * kilometres up is still in full sun for minutes after the water below it
 * has lost it. That is the whole of what a sunset sky is made of: the
 * ceiling burning orange over a sea that has already gone grey.
 */
export function litAt(altitude: number, elevation: number): number {
  const EARTH = 6_371_000;
  const dip = Math.sqrt((2 * Math.max(0, altitude)) / EARTH);
  // The disc is half a degree across, so the light goes over a band a
  // little wider than that rather than at a line.
  const t = clamp((elevation + dip) / (0.6 * DEG) + 0.5, 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * The hour at which the sun stands at `elevation`, on its way up (`rising`)
 * or down, to within a few minutes — or null when it never reaches it that
 * day. Both answers happen on this coast: a midsummer night never gets down
 * to −8°, and no hour of it gets up to +60°.
 */
export function hourOfElevation(
  elevation: number,
  rising: boolean,
  latitude: number,
): number | null {
  const from = rising ? 0 : 12;
  const STEP = 1 / 20;
  let was = sunAt(from, latitude).elevation - elevation;
  for (let h = from + STEP; h <= from + 12 + 1e-9; h += STEP) {
    const now = sunAt(h, latitude).elevation - elevation;
    if ((rising && was < 0 && now >= 0) || (!rising && was > 0 && now <= 0)) {
      // Linear between the two samples: the arc is a cosine, and a
      // twentieth of an hour of it is straight enough.
      const f = was / (was - now);
      return h - STEP + f * STEP;
    }
    was = now;
  }
  return null;
}

/** "16:00" — and "16:30" for a half, since a level's hour is a real number
 * rather than a whole one. */
export function hourLabel(hour: number): string {
  const total = Math.round((((hour % 24) + 24) % 24) * 60) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
