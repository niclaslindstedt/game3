// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT EACH SKY LOOKS LIKE — the tables `sky.ts` reads to put a lid on a
// clear one. Pure data: every number here is a colour or a fraction, and
// all the arithmetic that applies them is `sky.ts`'s.
//
// The engine decides WHICH sky a seed is under and how heavy it is (R19,
// `engine/mapgen/weather.ts`); this decides what that looks like. The split
// is the same one the rest of the app keeps: the engine owns the fact, the
// renderer owns the picture.

import type { BiomeId, Season, Weather } from "@engine";

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
  readonly [W in Weather]: W extends "clear" | "haze" | "high" ? OpenLook : WeatherLook;
};

/** The taiga coast's skies — the ladder every look was first authored
 * against, on a cold northern shore. */
const TAIGA_LOOKS: Looks = {
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
  // A HAZE is a warm coast's sky and a cold one never deals it, but every
  // coast has to be able to draw every word (`Looks` is total), so the
  // taiga's is here: the blue gone to milk, the sun a glare, the horizon
  // lost in white a few hundred metres out. Open — no lid, and the
  // gradient still shows through the whitening — because what a humid
  // morning lacks is not sky but distance.
  haze: {
    grey: 0xf2f3f0,
    mix: 0.4,
    dim: [0.84, 0.66],
    hemi: [1.1, 1.18],
    fogNear: [0.55, 0.4],
    fogFar: [0.6, 0.45],
    through: [0.7, 0.45],
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

/**
 * WHAT A SEASON DOES TO THE AIR — never to where the sun is, which is the
 * declination's and already in the elevation the ladder is keyed on. This
 * is only the year's colour cast and its clarity: a mix toward a tone for
 * the horizon band and the haze, a scale on how far the view runs, and a
 * scale on the sun's warmth. Applied in the proportion the sun is up
 * (`daytime`, sky.ts), because a colour cast is a statement about sunlight
 * and a midnight has none to cast.
 */
export type SeasonLook = {
  /** The horizon band and the haze, pulled toward this tone by this much. */
  horizon: [number, number];
  fog: [number, number];
  /** How far the view runs against the ladder's own, and how much of the
   * sun's own strength arrives. */
  reach: number;
  sun: number;
  /** How much of the ladder's own sea mist this season's mornings carry —
   * a scale on the rung's `mist`. */
  mist: number;
};

/** The taiga's seasons, each on the day `DECLINATION` puts it
 * (`engine/lib/solar.ts`). What the year does to the AIR is stated here;
 * what it does to the sun is already in the elevation. */
const TAIGA_SEASONS: Record<Season, SeasonLook> = {
  // May: the air scrubbed clean by the winter and the light hard and pale,
  // but the sea is at four degrees under air already at ten, which is the
  // recipe for sea fog — a cold coast's short spring is its foggy season,
  // a bank of advection fog lying on the cold water most mornings.
  spring: { horizon: [0xe4eef6, 0.18], fog: [0xd6e6f0, 0.14], reach: 1.06, sun: 1, mist: 1.35 },
  // The ladder was authored against a northern July, so this is the
  // baseline: nothing added.
  summer: { horizon: [0xffffff, 0], fog: [0xffffff, 0], reach: 1, sun: 1, mist: 1 },
  // Early October: the birch already yellow and the aspen red, a warmer,
  // browner horizon under a sun that is low the whole day, and the other
  // foggy season — the sea still holding the summer's warmth under air
  // that has had its first frosts, so the dawn steams.
  autumn: { horizon: [0xf0d8b8, 0.22], fog: [0xe4cfb6, 0.2], reach: 0.94, sun: 1.02, mist: 1.2 },
  // Mid-November, the last open water before the ice: the air cold and
  // blue and the sun weak and nine degrees up at its highest, the view
  // short, and sea smoke off the water on a still morning. Over the
  // shallows it is the colour of tin.
  winter: { horizon: [0xc4d0dc, 0.34], fog: [0xb8c4d0, 0.3], reach: 0.8, sun: 0.86, mist: 1.1 },
};

/** THE MANGROVE COAST'S SKIES. The same ladder under them — the rungs are
 * keyed on the sun's elevation, and a subtropical noon simply stands on a
 * higher one than the taiga ever reaches — so what is authored here is
 * only what the WEATHER over a warm coast does differently: the humidity
 * that never quite leaves the air, a winter front's lid that is paler
 * than a northern one, and an afternoon storm that is this coast's
 * squall. */
const MANGROVE_LOOKS: Looks = {
  // Bare blue over warm water is never quite bare: a little of the haze
  // is always in it, and the view is shorter than a scrubbed northern
  // morning's even on the clearest day of the year.
  clear: {
    grey: 0xe9eef1,
    mix: 0.06,
    dim: [1, 0.98],
    hemi: [1.04, 1.06],
    fogNear: [0.88, 0.8],
    fogFar: [0.9, 0.82],
    through: [1, 1],
  },
  // THE HAZE is this coast's ordinary summer sky and its signature: the
  // air over thirty-degree water is nearly saturated by mid-morning, the
  // blue goes to milk from the horizon up, the far shore is gone at a few
  // hundred metres and the sun is a white glare with no edge. The light
  // is still strong — it comes from the whole sky rather than from the
  // disc — which is why it dims the beam more than the skylight.
  haze: {
    grey: 0xf4f4ef,
    mix: 0.44,
    dim: [0.82, 0.62],
    hemi: [1.12, 1.2],
    fogNear: [0.5, 0.36],
    fogFar: [0.55, 0.4],
    through: [0.65, 0.4],
  },
  // A high sheet: the cirrus off a storm two hundred miles away, or the
  // first veil ahead of a front — the same sky as the taiga's, warmer.
  high: {
    grey: 0xe6e9e6,
    mix: 0.14,
    dim: [0.9, 0.74],
    hemi: [1.06, 1.16],
    fogNear: [0.85, 0.72],
    fogFar: [0.86, 0.75],
    through: [0.8, 0.5],
  },
  // A winter front's lid: paler and higher than a northern stratus, the
  // light flat but not dim — a grey day here is still bright enough to
  // squint at.
  overcast: {
    grey: 0xb4bcc4,
    mix: 0.46,
    dim: [0.68, 0.44],
    hemi: [1.02, 0.9],
    fogNear: [0.82, 0.66],
    fogFar: [0.85, 0.7],
    fogDeck: 0.42,
    overhead: [0xd4dae0, 0x9aa3ad],
    rim: 0x8b949e,
    rimMix: 0.82,
    base: [700, 400],
    relief: [0.06, 0.16],
    through: [0.28, 0.06],
  },
  // Rain is a white sky here as it is everywhere, and a warm one: the
  // deck glows, the air under it is thick with water, and the far shore
  // is gone at two hundred metres.
  rain: {
    grey: 0xa2aab4,
    mix: 0.46,
    dim: [0.8, 0.5],
    hemi: [1, 0.78],
    fogNear: [0.55, 0.36],
    fogFar: [0.58, 0.38],
    fogDeck: 0.62,
    overhead: [0xf4f7fa, 0x9aa3ad],
    rim: 0x8a929c,
    rimMix: 0.86,
    base: [420, 220],
    relief: [0.14, 0.36],
    through: [0.5, 0],
  },
  // THE AFTERNOON STORM — the thunderhead that stands up over a warm
  // coast most summer afternoons and comes off the land in a black wall.
  // The same shape as the taiga's line squall and blacker at the base,
  // but its rim is brighter still: a storm here is a cell, not a front,
  // and the sun is on the sea a few miles beyond it in every direction.
  squall: {
    grey: 0x505866,
    mix: 0.66,
    dim: [0.4, 0.16],
    hemi: [0.82, 0.44],
    fogNear: [0.45, 0.28],
    fogFar: [0.5, 0.32],
    fogDeck: 0.7,
    overhead: [0x30363f, 0x0c0f14],
    rim: 0xd6dbe0,
    rimMix: 0.6,
    base: [260, 140],
    relief: [0.34, 0.6],
    through: [0, 0],
  },
};

/** The mangrove's seasons, on the same dated days: the year is warm the
 * whole way through, so what changes is the humidity — thick in summer,
 * gone in the dry winter — and with it how far the view runs. */
const MANGROVE_SEASONS: Record<Season, SeasonLook> = {
  // May: the dry season's last weeks, the air still clear and the water
  // already warm. Little fog — a warm sea under warm air makes none.
  spring: { horizon: [0xf4f0e4, 0.1], fog: [0xece8dc, 0.08], reach: 1.04, sun: 1.02, mist: 0.5 },
  // Late July: the wet season, the air saturated by mid-morning, the
  // horizon white and the view short even under a clear word. The sun
  // is fierce and comes from everywhere.
  summer: { horizon: [0xf6f2e8, 0.24], fog: [0xeeeae0, 0.22], reach: 0.86, sun: 1.05, mist: 0.4 },
  // Early October: the wet season's tail, still humid, the storms still
  // building most afternoons.
  autumn: { horizon: [0xf2eadc, 0.14], fog: [0xe8e0cc, 0.12], reach: 0.94, sun: 1.02, mist: 0.5 },
  // Mid-November: the dry season's first cool air off the land, the
  // clearest light of the year, a blue horizon — and the one time this
  // coast fogs, on a still morning when the flats are cooler than the air.
  winter: { horizon: [0xe6edf4, 0.1], fog: [0xdfe7ef, 0.08], reach: 1.12, sun: 0.96, mist: 0.9 },
};

/** THE ARCTIC COAST'S SKIES. The same ladder, keyed on a sun that never
 * gets high and in two seasons never sets: what is authored here is what a
 * polar sky does that a northern one does not. The air is the driest and
 * clearest in the game when it is clear at all, and it is clear less often
 * than anywhere — a polar coast lives under stratus — and every one of the
 * three wet words is WHITE: the haze is sea smoke off the open water, the
 * rain is snow, and the squall is a blizzard, which is a white-out rather
 * than a black wall. Nothing here is warm; a polar sky that goes gold is a
 * sunset, and the sun does that on its own. */
const ARCTIC_LOOKS: Looks = {
  // Polar air with no water in it: the longest view in the game, the blue
  // deeper and darker than the taiga's, and the ice on the far shore
  // standing up hard-edged at the limit of the fog.
  clear: {
    grey: 0xffffff,
    mix: 0,
    dim: [1, 1],
    hemi: [1, 1.02],
    fogNear: [1.18, 1.24],
    fogFar: [1.18, 1.24],
    through: [1, 1],
  },
  // SEA SMOKE. Air twenty or thirty degrees colder than the water it is
  // crossing lifts the water's own steam off it in a low white fog that
  // stands a few metres high over every lead and every stretch of open
  // sea — the whole coast in it, the wall gone, the buoys arriving out of
  // white a hundred metres off. The shortest view in the game, and the
  // light is still bright: the sun is a disc over the top of it.
  haze: {
    grey: 0xf4f6f6,
    mix: 0.5,
    dim: [0.86, 0.7],
    hemi: [1.1, 1.18],
    fogNear: [0.4, 0.26],
    fogFar: [0.45, 0.3],
    through: [0.75, 0.5],
  },
  // A high sheet over the ice: the same veil as the taiga's, with more of
  // the sky's light coming off the snow and the sea ice below it, so the
  // skylight stays high while the disc softens.
  high: {
    grey: 0xe4eaef,
    mix: 0.14,
    dim: [0.9, 0.72],
    hemi: [1.08, 1.18],
    fogNear: [0.92, 0.8],
    fogFar: [0.94, 0.84],
    through: [0.8, 0.5],
  },
  // THE ORDINARY SKY HERE: a low grey stratus lid, dry, the light flat and
  // shadowless and the whole picture gone to greys and whites. Lower than
  // the taiga's — polar stratus hangs a few hundred metres up — and the
  // rim is nearly the lid's own grey, because there is nothing under it
  // for daylight to arrive through.
  overcast: {
    grey: 0xa4acb4,
    mix: 0.52,
    dim: [0.6, 0.36],
    hemi: [1, 0.84],
    fogNear: [0.84, 0.68],
    fogFar: [0.86, 0.7],
    fogDeck: 0.48,
    overhead: [0xcdd4da, 0x8e969e],
    rim: 0x7e8790,
    rimMix: 0.86,
    base: [400, 220],
    relief: [0.06, 0.16],
    through: [0.22, 0.04],
  },
  // SNOW. A white sky as rain is, and whiter: the deck glows, the air
  // under it is full of snow rather than water, and everything past two
  // hundred metres is a pale grey suggestion. The distance takes the
  // deck's own white rather than the blue behind it.
  rain: {
    grey: 0xb0b8c0,
    mix: 0.5,
    dim: [0.78, 0.48],
    hemi: [1, 0.8],
    fogNear: [0.5, 0.34],
    fogFar: [0.52, 0.36],
    fogDeck: 0.7,
    overhead: [0xf4f7fa, 0xa8b0b8],
    rim: 0x9aa2aa,
    rimMix: 0.9,
    base: [260, 140],
    relief: [0.1, 0.3],
    through: [0.45, 0],
  },
  // A BLIZZARD IS A WHITE-OUT, not a black wall. The taiga's squall is a
  // front kilometres thick that blacks the sky and lets daylight in under
  // its rim; a polar blizzard is snow driven off the ice at forty knots,
  // and the sky and the sea and the wall all go to one grey-white with
  // no horizon between them. The deck is dark overhead by the ordinary
  // rule — it is still a squall's cloud — but the rim is the brightest
  // thing in the picture and the view is a hundred metres.
  squall: {
    grey: 0x8a929c,
    mix: 0.66,
    dim: [0.4, 0.16],
    hemi: [0.84, 0.5],
    fogNear: [0.36, 0.22],
    fogFar: [0.4, 0.26],
    fogDeck: 0.78,
    overhead: [0x4a525c, 0x1e242b],
    rim: 0xd2d8de,
    rimMix: 0.6,
    base: [180, 100],
    relief: [0.3, 0.55],
    through: [0, 0],
  },
};

/** The arctic's seasons, on its OWN dated days (`Biome.declination`): the
 * ice going out under the midnight sun, the fog season of high summer, the
 * sea freezing under the first dark nights, and the sun back over the ice.
 * The air is cold and dry in every one of them, and what changes is how
 * much of the sea is open to smoke. */
const ARCTIC_SEASONS: Record<Season, SeasonLook> = {
  // Late May: the midnight sun a month old, the fjord ice breaking up, the
  // hardest and clearest light of the year — and the sun never off the
  // ice, so the horizon carries the pale gold of a sun that is always low.
  spring: { horizon: [0xf0e6d8, 0.16], fog: [0xe8eef2, 0.1], reach: 1.1, sun: 0.98, mist: 0.9 },
  // Late July: the open-water weeks and the fog season — the warmest water
  // of the year under air that is still cold, visibility under a
  // kilometre one day in five, the sun a disc in white.
  summer: { horizon: [0xeef0f0, 0.22], fog: [0xe6eaec, 0.2], reach: 0.84, sun: 0.96, mist: 1.6 },
  // Late September: the sun ten degrees up at noon and gone at night for
  // the first time since April, the air cold and blue, the sea starting
  // to freeze in the bays, and sea smoke on it on every still morning.
  autumn: { horizon: [0xd8dfe8, 0.28], fog: [0xcfd8e2, 0.24], reach: 0.94, sun: 0.9, mist: 1.3 },
  // Early March: the sun a fortnight back over the ice, six degrees up at
  // noon and never higher, a pink-and-blue light on everything with no
  // warmth in it at all, the air cold enough to fog on its own — and sea
  // smoke on every lead.
  winter: { horizon: [0xe4d4de, 0.34], fog: [0xd4dbe6, 0.3], reach: 0.9, sun: 0.82, mist: 1.4 },
};

/** THE KARST COAST'S SKIES. The same ladder under a sun that stands
 * between the taiga's and the mangrove's: what is authored here is what a
 * dry warm-temperate sky does that neither of those does. The clear sky
 * is the second-longest view in the game — the north wind that stands
 * this coast's sea up also scrubs its air, so the islands forty
 * kilometres off stand hard-edged on the rim — and the wet words are the
 * SOUTHERLY's: a warm, humid wind up the length of the sea that brings a
 * high veil, then a grey lid, then rain, in that order over a day. The
 * haze is a calm's — the heat of a windless afternoon in high summer
 * whitening the horizon until the islands float — and the squall is the
 * summer thunderstorm that stands up over the mountains behind the coast
 * and comes down onto the water as a black wall in twenty minutes. */
const KARST_LOOKS: Looks = {
  // Dry air with the north wind through it: the blue deep and hard, and
  // the far shore standing at the fog's limit as if cut out.
  clear: {
    grey: 0xffffff,
    mix: 0,
    dim: [1, 1],
    hemi: [1, 1.02],
    fogNear: [1.12, 1.16],
    fogFar: [1.12, 1.16],
    through: [1, 1],
  },
  // THE CALM'S HAZE: a windless August afternoon, the sea gone to oil,
  // the horizon whitened out and the islands floating on it with no line
  // under them, the sun a glare. Not the mangrove's saturated milk — the
  // air is dry — so the view stays longer than that coast's and the
  // light stays harder.
  haze: {
    grey: 0xf0f1ec,
    mix: 0.34,
    dim: [0.88, 0.72],
    hemi: [1.08, 1.16],
    fogNear: [0.62, 0.46],
    fogFar: [0.66, 0.5],
    through: [0.78, 0.52],
  },
  // The southerly's first sign: a veil of cirrus up the length of the sea
  // a day ahead of the front, the light going flat and the sea losing its
  // blue to a pewter under it.
  high: {
    grey: 0xe4e8ec,
    mix: 0.13,
    dim: [0.9, 0.74],
    hemi: [1.05, 1.15],
    fogNear: [0.9, 0.78],
    fogFar: [0.92, 0.82],
    through: [0.8, 0.5],
  },
  // THE SOUTHERLY'S LID: a warm grey sheet, lower than the mangrove's
  // winter front and warmer-toned than a northern stratus — the air under
  // it is humid and the light comes through it yellowish rather than
  // blue — and the sea under it the one dull colour this coast ever is.
  overcast: {
    grey: 0xa9aeb2,
    mix: 0.48,
    dim: [0.64, 0.4],
    hemi: [1, 0.86],
    fogNear: [0.8, 0.64],
    fogFar: [0.84, 0.68],
    fogDeck: 0.46,
    overhead: [0xcdd2d6, 0x8f969c],
    rim: 0x7e868d,
    rimMix: 0.84,
    base: [600, 320],
    relief: [0.08, 0.2],
    through: [0.26, 0.05],
  },
  // The southerly's rain: warm and heavy, a white sky as rain is
  // everywhere, and the view short — the islands gone, the headland
  // ahead a grey shape.
  rain: {
    grey: 0x9ba4ad,
    mix: 0.46,
    dim: [0.8, 0.5],
    hemi: [0.98, 0.76],
    fogNear: [0.56, 0.38],
    fogFar: [0.6, 0.4],
    fogDeck: 0.6,
    overhead: [0xf1f5f9, 0x959ea8],
    rim: 0x858e98,
    rimMix: 0.88,
    base: [340, 180],
    relief: [0.12, 0.34],
    through: [0.5, 0],
  },
  // THE SUMMER STORM OFF THE MOUNTAINS: a thunderhead that stands up over
  // the ridge behind the coast on a hot afternoon and comes down onto the
  // sea as a black wall with a squall of wind ahead of it, the whole
  // thing over in half an hour. Black at the base like the taiga's front
  // and the rim as bright as the mangrove's cell — the storm comes off
  // the land, so the open sea beyond it is still in sun.
  squall: {
    grey: 0x4e5664,
    mix: 0.66,
    dim: [0.4, 0.16],
    hemi: [0.8, 0.44],
    fogNear: [0.44, 0.28],
    fogFar: [0.5, 0.32],
    fogDeck: 0.72,
    overhead: [0x2e343e, 0x0b0e13],
    rim: 0xd2d8de,
    rimMix: 0.62,
    base: [220, 120],
    relief: [0.34, 0.6],
    through: [0, 0],
  },
};

/** The karst's seasons, on the taiga's dated days: a dry hot summer and a
 * wet mild winter, and the two winds between them — the southerly's
 * humidity in the autumn, and the north wind's scrubbed air in the
 * winter, which is when this coast has its longest views of the year. */
const KARST_SEASONS: Record<Season, SeasonLook> = {
  // May: the sea already warm, the air still clear after the spring's
  // last north winds, the hills green for the only month they are, and
  // the light strong. No fog to speak of — the sea is warmer than the
  // air by the afternoon.
  spring: { horizon: [0xecf1f6, 0.1], fog: [0xe4ecf2, 0.08], reach: 1.06, sun: 1.02, mist: 0.5 },
  // Late July: the heat. A white sky at the horizon on the calm days,
  // the hills brown, the sun fierce, and the sea at its bluest under it.
  summer: { horizon: [0xf4efe2, 0.22], fog: [0xede8dc, 0.2], reach: 0.88, sun: 1.06, mist: 0.3 },
  // Early October: the southerly's season and the wettest weeks of the
  // year — the sea still warm, the air humid, the storms standing up
  // most afternoons, a warm and hazy horizon.
  autumn: { horizon: [0xf0e6d8, 0.18], fog: [0xe6dfd2, 0.16], reach: 0.92, sun: 1, mist: 0.5 },
  // Mid-November: the north wind's season. The clearest, hardest air of
  // the year — a hundred kilometres of view on the morning after a blow
  // — cold, blue, the sun low, and on the stillest mornings a little
  // steam off a sea that is still warmer than the air over it.
  winter: { horizon: [0xdfe8f2, 0.16], fog: [0xd8e2ec, 0.12], reach: 1.14, sun: 0.94, mist: 0.7 },
};

/** Every coast's skies and seasons, keyed the way `BIOMES` is: a coast the
 * engine can build without a row here has no sky, and `tests/biome_test.ts`
 * holds the two lists to each other. */
export const SKY_LOOKS: Readonly<Partial<Record<BiomeId, Looks>>> = {
  taiga: TAIGA_LOOKS,
  mangrove: MANGROVE_LOOKS,
  arctic: ARCTIC_LOOKS,
  karst: KARST_LOOKS,
};

export const SEASON_LOOKS: Readonly<Partial<Record<BiomeId, Record<Season, SeasonLook>>>> = {
  taiga: TAIGA_SEASONS,
  mangrove: MANGROVE_SEASONS,
  arctic: ARCTIC_SEASONS,
  karst: KARST_SEASONS,
};

/** A coast's skies; throws for one nobody has painted a sky for. */
export function looksOf(biome: BiomeId): Looks {
  const row = SKY_LOOKS[biome];
  if (!row) throw new Error(`no sky is painted for the "${biome}" coast yet`);
  return row;
}

/** A coast's seasons; throws the same way. */
export function seasonsOf(biome: BiomeId): Record<Season, SeasonLook> {
  const row = SEASON_LOOKS[biome];
  if (!row) throw new Error(`no seasons are painted for the "${biome}" coast yet`);
  return row;
}
