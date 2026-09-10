// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE SUN IS, READ AS A KIND OF LIGHT. A level is not ridden at
// "dusk"; it is ridden at 20:40 at 62°N, and dusk is what that turns out to
// be. The astronomy itself is the engine's (`engine/lib/solar.ts`) because
// the LEVEL GENERATOR needs the same arithmetic to pick an hour at all
// (R13); what lives here is what the app makes of the answer.
//
// THE GAME HAS NO NIGHT. R13 draws every level's hour from the window in
// which the sun is over the horizon, so the darkest sky a rider is ever
// under is a sun sitting on the water. That is a rule about the LEVEL, and
// it is why nothing here has a word, a moon or a star for the dark: on the
// water there is no ridge line and no street lamp, and a sea nobody can
// read the waves of is a level nobody can ride.
//
// THE SEASON IS FIXED at high summer (the engine's `SUMMER_DECLINATION`).
// The game is a northern summer — the water is 8–18 °C, the shore is in
// leaf — and a season dial would be a second clock nobody is asking to set.
//
// DOM-free and three-free on purpose: `sky.ts` reads it, and the tests read
// all of it without standing up a renderer.

import { sunAt, type SunPlace } from "@engine";

export { SOUTH, sunAt, hourOfElevation, SUMMER_DECLINATION, type SunPlace } from "@engine";

const DEG = Math.PI / 180;

/** Which of the three kinds of daylight a moment is — the word for a sky,
 * for anything that keys on one rather than on a number. The sky itself
 * never reads it: the sky reads the elevation, and this is that elevation
 * binned. */
export type Daylight = "dawn" | "day" | "dusk";

/** Above this the sun is plain DAY, radians. Under it the word is dawn or
 * dusk by which way the sun is going — and there is no fourth word, because
 * R13 never puts a level under a sun that has gone. */
export const DAY_ABOVE = 10 * DEG;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** The word for this much sun. */
export function daylightOf(sun: Pick<SunPlace, "elevation" | "rising">): Daylight {
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

/** Where the sun stands at an hour on a coast, for callers that already
 * have the level's own latitude. */
export function sunOver(hour: number, latitude: number): SunPlace {
  return sunAt(hour, latitude);
}

/** "16:00" — and "16:30" for a half, since a level's hour is a real number
 * rather than a whole one. */
export function hourLabel(hour: number): string {
  const total = Math.round((((hour % 24) + 24) % 24) * 60) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
