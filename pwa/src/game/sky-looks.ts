// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT EACH SKY LOOKS LIKE — the tables `sky.ts` reads to put a lid on a
// clear one. Pure data: every number here is a colour or a fraction, and
// all the arithmetic that applies them is `sky.ts`'s.
//
// The engine decides WHICH sky a seed is under and how heavy it is (R19,
// `engine/mapgen/weather.ts`); this decides what that looks like. The split
// is the same one the rest of the app keeps: the engine owns the fact, the
// renderer owns the picture.

import type { Weather } from "@engine";

/**
 * ONE SKY, AT ITS LIGHTEST AND AT ITS HEAVIEST.
 *
 * Every pair here is read at the level's own cover (`skyCover`, which is
 * where the seeded wind sits in R12's band), so no two overcast levels are
 * the same overcast: one is ridden under a high thin sheet with the light
 * still coming through it, the next under a low black one over a sea that
 * is running two metres. A single authored grey is what makes every bad-
 * weather level in a game look like the same bad-weather level.
 */
export type WeatherLook = {
  /** What the open sky left under the lid is mixed toward, and how far. */
  grey: number;
  mix: number;
  /** What survives of the sun's beam and of the skylight, thin → thick. A
   * heavy deck is not a filter over daylight: a squall at noon puts a few
   * per cent of full sun on the water. */
  dim: [number, number];
  hemi: [number, number];
  /** Fog distances, as fractions of the clear sky's own, thin → thick.
   * Heavier weather is not only darker, it is SHORTER — the water in the
   * air between the rider and the next gate is most of what weather does
   * to riding. */
  fogNear: [number, number];
  fogFar: [number, number];
  /** How much of the DECK's own colour the distance takes. Rain whitens the
   * air and a squall blackens it, and in both cases what the far shore
   * fades into is the underside of the cloud rather than the blue behind
   * it. */
  fogDeck: number;
  /** The deck's underside directly overhead, thin → thick, in full
   * daylight — `sky.ts` darkens it with the hour, so a midnight squall is
   * black overhead rather than a white ceiling over a dark sea. */
  overhead: [number, number];
  /** WHAT THE CEILING IS OUT AT THE RIM, and how far the hour's own
   * horizon is pulled toward it, 0..1.
   *
   * Which way this runs against `overhead` is the difference between the
   * two kinds of bad sky, and it is not a matter of taste. A sheet that
   * reaches the horizon — an overcast lid, a rain deck — is DARKER at the
   * rim than overhead, because that line of sight runs the long way
   * through the cloud; there is no gap under it for daylight to arrive
   * through, so the rim is very nearly the ceiling's own grey and the
   * hour's horizon barely shows (a `rimMix` near one). A SQUALL is the
   * opposite: its base is a front with clear air beyond it, so daylight
   * comes in UNDER the base and the rim is the brightest thing in the sky.
   */
  rim: number;
  rimMix: number;
  /** How high the base hangs, m, and how ragged its underside is, thin →
   * thick. */
  base: [number, number];
  relief: [number, number];
  /** How much of the sun's BEAM comes through, thin → thick: a lit patch
   * behind a high sheet, nothing at all behind a squall's ceiling. It is
   * also what is left of the disc and of the halo, and — the one that shows
   * on the water — of the SHADOW anything throws. */
  through: [number, number];
};

/** A sky with no lid over it — the open ones. `sky.ts` reads the same
 * fields for them, which is what lets a high sheet dim the day without
 * having to be a special case anywhere downstream. */
export type OpenLook = Pick<WeatherLook, "grey" | "mix" | "dim" | "hemi" | "through"> & {
  fogNear: [number, number];
  fogFar: [number, number];
};

/** How a coast's skies look — one row per sky the engine can hand over, the
 * open ones typed open and the lidded ones lidded. Mapped over `Weather`
 * rather than listed, so a sky added to the engine's vocabulary is a
 * compile error here until somebody paints it. */
export type Looks = {
  readonly [W in Weather]: W extends "clear" | "high" ? OpenLook : WeatherLook;
};

export const TAIGA_LOOKS: Looks = {
  // A CLEAR SKY is the ladder untouched, and it is EMPTY: not a thin ring of
  // cumulus, not one puff on the rim — bare air from one horizon to the
  // other (`dressSky` rolls it no sheets at all). R19 already has a sky for
  // "fair, with something in it" and it is `high`; leaving a token cloud in
  // this one is what made the two read as the same picture. What carries a
  // clear day instead is the gradient, the glare on the water and the sun's
  // road across it — which is what a flat calm at 06:00 actually looks like.
  clear: {
    grey: 0xffffff,
    mix: 0,
    dim: [1, 1],
    hemi: [1, 1],
    fogNear: [1, 1.05],
    fogFar: [1, 1.05],
    through: [1, 1],
  },
  // HIGH CLOUD is the sky that costs a game nothing and buys it most: no
  // lid, no shorter view, just a sheet of cirrostratus the light comes
  // through. The blue goes milky, the sun keeps its disc but loses its
  // edge, and — the part that reads on the water — the shadows go soft.
  // Half the seeds should get something like this rather than bare blue.
  //
  // The numbers here are what the LIGHT does; the sky's SHAPE is the cloud
  // chart's, and this is the one weather whose stack has two floors in it —
  // a cirrus veil eight kilometres up over fair-weather cumulus a kilometre
  // above the water, drifting at their own two paces. That parallax is what
  // separates this sky from the clear one beside it, and until it existed
  // the two came back off `make sky` as the same picture.
  high: {
    grey: 0xdfe7ee,
    // Half what it was before the veil was a real sheet: the milkiness used
    // to have to STAND IN for cirrus, and now that the cirrus is drawn, the
    // same mix over it whites the sky out and the veil has no blue to read
    // against.
    mix: 0.13,
    dim: [0.9, 0.74],
    hemi: [1.05, 1.15],
    fogNear: [0.92, 0.8],
    fogFar: [0.94, 0.84],
    through: [0.8, 0.5],
  },
  // OVERCAST is a DRY lid: a flat stratus ceiling, high and even, the light
  // shadowless and the colour gone out of everything. Nothing falls out of
  // it, so the view stays long — which is exactly what separates it from
  // rain, and why the two are two skies rather than one at two strengths.
  overcast: {
    grey: 0x9fa8b2,
    mix: 0.5,
    dim: [0.62, 0.38],
    hemi: [1, 0.86],
    fogNear: [0.85, 0.7],
    fogFar: [0.88, 0.72],
    fogDeck: 0.45,
    overhead: [0xc8d0d8, 0x8b949e],
    rim: 0x79828c,
    rimMix: 0.85,
    base: [520, 300],
    relief: [0.06, 0.18],
    through: [0.25, 0.05],
  },
  // RAIN IS A WHITE SKY, and getting that the wrong way round is the most
  // common mistake in a game's weather. The deck is thin enough that the
  // sun lights it from above and it GLOWS: overhead it is the brightest
  // thing in the frame, brighter than the water, which is why a photograph
  // of a wet day comes back with a blown-out sky. It greys off toward the
  // rim because that line of sight runs the long way through the cloud.
  // What makes it read as rain rather than as a bright overcast is the
  // distance: the far shore is gone at two hundred metres.
  rain: {
    grey: 0x98a2ae,
    mix: 0.46,
    dim: [0.8, 0.5],
    hemi: [0.98, 0.76],
    fogNear: [0.6, 0.4],
    fogFar: [0.62, 0.4],
    fogDeck: 0.6,
    overhead: [0xf2f6fa, 0x929ba6],
    rim: 0x828b96,
    rimMix: 0.88,
    base: [300, 160],
    relief: [0.12, 0.34],
    through: [0.5, 0],
  },
  // A SQUALL IS A BLACK ONE, and it is black for the opposite reason: the
  // cloud is kilometres thick, nothing gets through it, and the underside
  // is in its own shadow. The single bright thing left in the sky is the
  // strip at the rim where daylight arrives under the base from outside the
  // weather — the gust-front look, and the reason a squall reads as
  // something ARRIVING rather than as a night that came early. Over open
  // water, with no ridge to hide the rim, that strip runs the whole way
  // round the horizon and it is the best picture this game can make.
  squall: {
    grey: 0x555d6a,
    mix: 0.64,
    dim: [0.42, 0.18],
    hemi: [0.8, 0.46],
    fogNear: [0.45, 0.3],
    fogFar: [0.5, 0.34],
    fogDeck: 0.72,
    overhead: [0x333a45, 0x0e1116],
    rim: 0xc8ced6,
    rimMix: 0.66,
    base: [200, 110],
    relief: [0.32, 0.58],
    through: [0, 0],
  },
};
