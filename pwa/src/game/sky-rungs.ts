// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DAY'S RUNGS. The sky is authored as a LADDER of complete looks — the
// two sunrises-and-sets, the two low suns, morning and full day — each one a
// whole palette rather than a curve per colour, and the hour blends between
// the two rungs the sun stands between.
//
// Authoring them whole is what keeps a sunset a sunset. Every colour in one
// of these rows was chosen against the others in the same row: the horizon
// against the zenith, the water's bounce against the key, the cloud's lit
// face against its shade. Eight independent curves through the same numbers
// give you eight tasteful greys somewhere in the middle and no moment that
// looks like anything.
//
// THESE ARE A SEA'S RUNGS, not a landscape's, and that is the one place
// they part company with the same ladder over a rally stage. The horizon is
// water for 360°, so the band just above it is haze off the sea rather than
// dust off a road: cooler, paler, and never as warm as the sky over it. And
// the light that comes back UP (`hemiGround`) is the water's own — a deep
// green-teal by day — which is why everything on this coast has a cold
// underside where a car in a forest has a warm one.
//
// THE LADDER'S FLOOR IS THE HORIZON. R13 draws every level's hour from the
// coast's daylight, so no rider is ever under a sun that has set and there
// is no twilight or dark rung to blend toward: under `SET` the ladder simply
// holds. A sun on the water is as dramatic as this game's sky gets, and it
// is a sky the sea can still be read through.

import type { Rung } from "./sky.ts";

/** THE SUN ON THE WATER — the disc a swollen orange coin sitting on the
 * horizon with its track laid across the sea toward the rider. The sky over
 * it goes purple and the rim rose; the red belongs to the band round the
 * sun and nowhere else. The most dramatic sky on the ladder, and on this
 * coast it lasts the best part of an hour. */
export const DUSK_SET: Rung = {
  zenith: 0x35306e,
  horizon: 0xef8a60,
  glow: 0xff4f42,
  glowStrength: 1.4,
  sun: 0xff9257,
  sunIntensity: 1.2,
  hemiSky: 0xc09cc8,
  hemiGround: 0x2c3a44,
  hemiIntensity: 0.7,
  fog: 0xd08c78,
  fogNear: 80,
  fogFar: 400,
  disc: 0xffb36a,
  discSize: 32,
  halo: 0xff5f46,
  haloSize: 220,
  haloOpacity: 0.62,
  cloud: 0xff9a74,
  cloudShade: 0x745a80,
  cloudOpacity: 1,
};

/** Sunrise over a cold sea: pale, misty, peach, the disc huge and soft in
 * the haze sitting on the water. Nothing like the evening's fire. */
export const DAWN_SET: Rung = {
  zenith: 0x4f6cb0,
  horizon: 0xffc0a0,
  glow: 0xff9a5e,
  glowStrength: 1.2,
  sun: 0xffb888,
  sunIntensity: 1.15,
  hemiSky: 0xcad2f0,
  hemiGround: 0x38505c,
  hemiIntensity: 0.74,
  fog: 0xe6c4b0,
  fogNear: 55,
  fogFar: 360,
  disc: 0xffe0b8,
  discSize: 32,
  halo: 0xffa060,
  haloSize: 210,
  haloOpacity: 0.58,
  cloud: 0xffc0a8,
  cloudShade: 0x84808f,
  cloudOpacity: 1,
};

/** The golden hour going down, the sun eight degrees up: the water still
 * blue under the rider and running to gold out toward the light. */
export const DUSK_LOW: Rung = {
  zenith: 0x3a5cae,
  horizon: 0xffb478,
  glow: 0xff8a50,
  glowStrength: 1,
  sun: 0xffb070,
  sunIntensity: 1.35,
  hemiSky: 0xdcc6d0,
  hemiGround: 0x3a5460,
  hemiIntensity: 0.86,
  fog: 0xe6b498,
  fogNear: 95,
  fogFar: 430,
  disc: 0xffd090,
  discSize: 27,
  halo: 0xffa060,
  haloSize: 180,
  haloOpacity: 0.5,
  cloud: 0xffd0b0,
  cloudShade: 0x9a8898,
  cloudOpacity: 1,
};

/** …and the same height on the way up, an hour after a three-in-the-morning
 * sunrise: cooler, cleaner, the haze not yet burnt off the water. */
export const DAWN_LOW: Rung = {
  zenith: 0x577cc2,
  horizon: 0xffcaa8,
  glow: 0xff9a58,
  glowStrength: 1.1,
  sun: 0xffc08a,
  sunIntensity: 1.35,
  hemiSky: 0xd4dcf8,
  hemiGround: 0x3c5a66,
  hemiIntensity: 0.86,
  fog: 0xeecdb2,
  fogNear: 65,
  fogFar: 400,
  disc: 0xffe0b8,
  discSize: 27,
  halo: 0xffa060,
  haloSize: 180,
  haloOpacity: 0.54,
  cloud: 0xffd9c0,
  cloudShade: 0xa09aa8,
  cloudOpacity: 1,
};

/** Mid-morning and mid-evening: plain northern light, the horizon band pale
 * with sea haze. */
export const MORNING: Rung = {
  zenith: 0x2c74d4,
  horizon: 0xd2e6f4,
  glow: 0xffe8c8,
  glowStrength: 0.55,
  sun: 0xffe8c4,
  sunIntensity: 1.45,
  hemiSky: 0xf2f8ff,
  hemiGround: 0x4a7480,
  hemiIntensity: 1.5,
  fog: 0xc6e0ee,
  fogNear: 125,
  fogFar: 500,
  disc: 0xfff4e0,
  discSize: 20,
  halo: 0xfff0d0,
  haloSize: 140,
  haloOpacity: 0.4,
  cloud: 0xfff4ea,
  cloudShade: 0xc2ccd8,
  cloudOpacity: 1,
};

/** The bright baseline every other light in the game was authored against —
 * and the sky the app's palette is named for (`PALETTE.sky`, `skyHigh`).
 * A deep blue overhead, the pale haze band on the water. */
export const DAY: Rung = {
  zenith: 0x1f6fd8,
  horizon: 0xd7e9f0,
  glow: 0xfff3c8,
  glowStrength: 0.35,
  sun: 0xfff2dc,
  sunIntensity: 1.5,
  hemiSky: 0xffffff,
  hemiGround: 0x53808c,
  hemiIntensity: 1.6,
  fog: 0xbcdcea,
  fogNear: 145,
  fogFar: 560,
  disc: 0xfff8dc,
  discSize: 18,
  halo: 0xfff3c8,
  haloSize: 115,
  haloOpacity: 0.35,
  cloud: 0xffffff,
  cloudShade: 0xd6e0ec,
  cloudOpacity: 1,
};

/** The rungs in order of the sun's elevation, degrees, for each half of the
 * day. Below the first — the sun ON the horizon, which R13 makes the lowest
 * a level can be ridden at — and above the last, the ladder simply holds. */
export const KEYS: readonly { at: number; dawn: Rung; dusk: Rung }[] = [
  { at: 0, dawn: DAWN_SET, dusk: DUSK_SET },
  { at: 8, dawn: DAWN_LOW, dusk: DUSK_LOW },
  { at: 22, dawn: MORNING, dusk: MORNING },
  { at: 40, dawn: DAY, dusk: DAY },
];
