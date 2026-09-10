// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE SUN IS, READ AS A KIND OF LIGHT. A level is not ridden at
// "dusk"; it is ridden at 20:40 in September at 62°N, and dusk is what
// that turns out to be. The astronomy itself is the engine's
// (`engine/lib/solar.ts`) because the LEVEL GENERATOR needs the same
// arithmetic to pick an hour at all (R13); what lives here is what the app
// makes of the answer.
//
// THE SUN MOVES. The engine's clock runs an hour of sun a minute of riding
// (`sunHourAt`), so a run started at sunset rides into the twilight and
// then the dark, and the whole of what follows is decided by three numbers
// that are all facts about the level: the hour it started at, its SEASON
// (the sun's declination) and its coast's latitude. The consequences are
// the point, and they are all real:
//
//   * a taiga midsummer night never gets darker than civil twilight — the
//     sun dips 4.6° under the horizon at midnight and no further — so a
//     June run rides a long blue dusk that turns straight into dawn;
//   * a September night there is black, with the stars out and the full
//     moon the only light on the water;
//   * a December noon is a sun four degrees off the sea, and a run started
//     at it is dark twenty minutes later.
//
// DOM-free and three-free on purpose: `sky.ts` reads it, the HUD's clock
// reads it to name the light, and the tests read all of it without
// standing up a renderer.

import { DECLINATION, sunAt, sunHourAt, type Level, type SunPlace } from "@engine";

export { SOUTH, sunAt, hourOfElevation, type SunPlace } from "@engine";

const DEG = Math.PI / 180;

/** Which of the four kinds of light a moment is — the word for a sky, for
 * anything that keys on one rather than on a number. The sky itself never
 * reads it: the sky reads the elevation, and this is that elevation
 * binned. */
export type Daylight = "dawn" | "day" | "dusk" | "night";

/** Below this the sun is NIGHT: the end of civil twilight, six degrees
 * under, radians — the point a real evening stops being usable without a
 * lamp. Above `DAY_ABOVE` it is plain day; between the two the word is dawn
 * or dusk by which way the sun is going. */
export const NIGHT_BELOW = -6 * DEG;
export const DAY_ABOVE = 10 * DEG;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** The word for this much sun. */
export function daylightOf(sun: Pick<SunPlace, "elevation" | "rising">): Daylight {
  if (sun.elevation < NIGHT_BELOW) return "night";
  if (sun.elevation >= DAY_ABOVE) return "day";
  return sun.rising ? "dawn" : "dusk";
}

/** The full moon's place — dead opposite the sun, which is what a full
 * moon IS: high at midnight in winter, barely over the horizon on a
 * midsummer night, and the key light every dark stretch of water is ridden
 * under. */
export function moonAt(sun: SunPlace): { elevation: number; azimuth: number } {
  return { elevation: -sun.elevation, azimuth: sun.azimuth + Math.PI };
}

/**
 * HOW MUCH THE CRAFT'S LAMP IS LIT, 0..1, for a sun at `elevation` rad —
 * the rider's hand on the switch. Off through the day, on as the sun
 * touches the water, and full by the time it is a couple of degrees under:
 * a lamp switched on in daylight lights nothing anybody can see, and one
 * that waited for the dark would leave the first dim minutes of a dusk run
 * unlit. Smoothed over a few degrees rather than thrown, because what it
 * feeds is a pool of light on the water and a pool that appears on one
 * frame reads as a fault.
 */
export function lampsAt(elevation: number): number {
  const t = clamp((2 * DEG - elevation) / (4 * DEG), 0, 1);
  return t * t * (3 - 2 * t);
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

/** Where the sun stands at an hour on a coast in a season, for callers
 * that already have the level's own latitude. */
export function sunOver(hour: number, latitude: number, season: Level["season"]): SunPlace {
  return sunAt(hour, latitude, DECLINATION[season]);
}

/** Where the sun stands NOW — at run time `t` on this level, its clock run
 * on from the hour it was dealt. */
export function sunNow(
  level: Pick<Level, "hour" | "season">,
  latitude: number,
  t: number,
): SunPlace {
  return sunOver(sunHourAt(level, t), latitude, level.season);
}

/** "16:00" — and "16:30" for a half, since a level's hour is a real number
 * rather than a whole one. */
export function hourLabel(hour: number): string {
  const total = Math.round((((hour % 24) + 24) % 24) * 60) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
