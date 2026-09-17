// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE POLAR COAST'S COVER — the arctic third of the roster. It lives beside
// `flora-defs.ts` for the reason `defs/fauna-arctic.ts` lives beside the
// catalog: one subject, one placer, one lab, and a parent file that had
// grown past the §20.5 cap. `FLORA` is still how the whole app spells the
// roster — `flora-defs.ts` spreads these rows onto the end of it — and
// nothing anywhere reads this module directly. What a row MEANS (the look,
// the habitat, the forms) is stated there and not repeated here.
//
// A polar shore has NO TREES, and its ladder is a few centimetres high:
// everything on it grows flat to the ground out of the wind, in cushions
// and mats on the moraine, and what stands up over the rider's head is ICE,
// not wood. The ladder itself is in `flora-defs.ts`'s header with the other
// two coasts'.

import type { FloraSpec } from "./flora-defs.ts";

export const ARCTIC_FLORA: readonly FloraSpec[] = [
  {
    id: "kelp",
    name: "Kelp (Laminaria)",
    biomes: ["arctic"],
    look: {
      // Long brown blades standing up off the stones under the front and
      // laid over by the current: the reed's builder, in brown, under the
      // water — the one thing that grows in this sea.
      form: "reed",
      height: { min: 0.8, max: 2.2 },
      spread: 0.9,
      stems: 10,
      bare: 0,
      stem: 0x4a3a22,
      stemHigh: 0x5a4a2a,
      leafLit: 0x6a5a30,
      leafDark: 0x3a3018,
    },
    habitat: {
      // Wholly under the water, on the stones off the gravel: its crown is
      // a metre or two under the surface and never breaks it.
      ground: { min: -4, max: -1.2 },
      inland: { min: -20, max: -3 },
      surfaces: [],
      slope: 0.5,
      share: 1.2,
      shelter: 0.12,
      patch: { scale: 60, over: 0.34 },
    },
  },
  {
    id: "strandedice",
    name: "Stranded ice (bergy bits and floes on the tideline)",
    biomes: ["arctic"],
    look: {
      // The cobble's builder at a berg's size, in white: the tide leaves
      // the front's calvings on the gravel, and the tideline of a glacier
      // coast is a row of them a man high. Nothing in the roster is a
      // solid, and a bergy bit the hull rides through is the deal the
      // renderer's cover has always made.
      form: "stone",
      height: { min: 0.6, max: 3 },
      spread: 1.8,
      stems: 1,
      bare: 0,
      stem: 0xbcd4e2,
      leafLit: 0xeef5fa,
      leafDark: 0xa0c0d4,
    },
    habitat: {
      // Across the waterline and the wet gravel just above it.
      ground: { min: -1, max: 1.4 },
      inland: { min: -10, max: 7 },
      surfaces: [],
      slope: 0.8,
      share: 1.6,
      patch: { scale: 40, over: 0.42 },
    },
  },
  {
    id: "moraine",
    name: "Moraine cobbles and blocks",
    biomes: ["arctic"],
    look: {
      form: "stone",
      height: { min: 0.25, max: 1.2 },
      spread: 1.5,
      stems: 1,
      bare: 0,
      stem: 0x5a5854,
      leafLit: 0x6c6a66,
      leafDark: 0x45433f,
    },
    habitat: {
      // Everywhere the ice dropped it: across the waterline and up the
      // whole moraine, and never on the wall.
      ground: { min: -0.9, max: 5 },
      inland: { min: -8, max: 60 },
      surfaces: [],
      slope: 0.75,
      share: 3.5,
      patch: { scale: 36, over: 0.3 },
    },
  },
  {
    id: "cottongrass",
    name: "Cotton grass (Eriophorum)",
    biomes: ["arctic"],
    look: {
      form: "tuft",
      height: { min: 0.15, max: 0.32 },
      spread: 0.9,
      stems: 12,
      bare: 0,
      stem: 0x7a8a5a,
      // The white heads: a wet flat in July is a field of them, and it is
      // the one thing on the tundra that reads white against the ground.
      stemHigh: 0xf2f2ec,
      leafLit: 0xe8ece2,
      leafDark: 0x8a9a6a,
    },
    habitat: {
      // Wet ground: the flats behind the gravel and the melt along the
      // crack, where it takes the bank the reed takes on the taiga.
      ground: { min: 0.2, max: 3 },
      inland: { min: 2, max: 90 },
      surfaces: [],
      slope: 0.3,
      share: 1.2,
      riverside: { within: 80, share: 4 },
      patch: { scale: 50, over: 0.38 },
    },
  },
  {
    id: "mossmat",
    name: "Moss mat",
    biomes: ["arctic"],
    look: {
      // A mat rather than a plant: the bush builder at its flattest and
      // widest, a green skin over the till.
      form: "bush",
      height: { min: 0.03, max: 0.06 },
      spread: 6,
      stems: 1,
      bare: 0,
      stem: 0x3a4a2a,
      leafLit: 0x5a8a3a,
      leafDark: 0x2e4a24,
    },
    habitat: {
      ground: { min: 0.2, max: 6 },
      inland: { min: 2, max: 140 },
      surfaces: [],
      slope: 0.4,
      share: 3,
      riverside: { within: 80, share: 5 },
      patch: { scale: 44, over: 0.34 },
    },
  },
  {
    id: "saxifrage",
    name: "Purple saxifrage (Saxifraga oppositifolia)",
    biomes: ["arctic"],
    look: {
      // A cushion, and in flower it is PURPLE — the first colour on the
      // coast in the spring and the loudest thing on the moraine at any
      // range, because nothing else here is not grey or white.
      form: "bush",
      height: { min: 0.05, max: 0.12 },
      spread: 3.2,
      stems: 1,
      bare: 0,
      stem: 0x4a4a40,
      leafLit: 0xa85aa0,
      leafDark: 0x5a3a5a,
    },
    habitat: {
      ground: { min: 0.3, max: 12 },
      inland: { min: 2, max: 200 },
      surfaces: ["rock", "sand", "bedrock"],
      slope: 0.6,
      share: 3,
      patch: { scale: 40, over: 0.36 },
    },
  },
  {
    id: "campion",
    name: "Moss campion (Silene acaulis)",
    biomes: ["arctic"],
    look: {
      form: "bush",
      height: { min: 0.04, max: 0.09 },
      spread: 2.8,
      stems: 1,
      bare: 0,
      stem: 0x4a4a40,
      // Pink over the green cushion, the south side first.
      leafLit: 0xd88aa0,
      leafDark: 0x4a6a3a,
    },
    habitat: {
      ground: { min: 0.5, max: 10 },
      inland: { min: 4, max: 200 },
      surfaces: ["rock", "sand"],
      slope: 0.6,
      share: 1.5,
      patch: { scale: 46, over: 0.4 },
    },
  },
  {
    id: "polarwillow",
    name: "Polar willow (Salix polaris)",
    biomes: ["arctic"],
    look: {
      // A tree an inch high: the willow's builder at a fiftieth of the
      // taiga's sallow, flat to the gravel.
      form: "bush",
      height: { min: 0.04, max: 0.1 },
      spread: 3.5,
      stems: 1,
      bare: 0,
      stem: 0x5a4a3a,
      leafLit: 0x7a9a4a,
      leafDark: 0x3e5a2c,
    },
    habitat: {
      // The late snowbeds: low, damp ground, snow-free by the middle of
      // July.
      ground: { min: 0.3, max: 8 },
      inland: { min: 3, max: 200 },
      surfaces: ["sand", "rock"],
      slope: 0.45,
      share: 2.5,
      patch: { scale: 52, over: 0.36 },
    },
  },
  {
    id: "avens",
    name: "Mountain avens (Dryas)",
    biomes: ["arctic"],
    look: {
      form: "bush",
      height: { min: 0.04, max: 0.1 },
      spread: 3,
      stems: 1,
      bare: 0,
      stem: 0x5a5a4a,
      // White eight-petalled flowers over a dark mat.
      leafLit: 0xdcdccc,
      leafDark: 0x4a5a3a,
    },
    habitat: {
      // The wind-exposed ridges of the moraine.
      ground: { min: 1, max: 15 },
      inland: { min: 6, max: 200 },
      surfaces: ["rock", "bedrock"],
      slope: 0.6,
      share: 2,
      patch: { scale: 48, over: 0.38 },
    },
  },
  {
    id: "poppy",
    name: "Arctic poppy (Papaver)",
    biomes: ["arctic"],
    look: {
      form: "tuft",
      height: { min: 0.1, max: 0.25 },
      spread: 0.8,
      stems: 6,
      bare: 0,
      stem: 0x7a8a5a,
      // Yellow, on the barest gravel: the one warm colour on the coast.
      stemHigh: 0xe8d060,
      leafLit: 0xe6d466,
      leafDark: 0x8a9a5a,
    },
    habitat: {
      ground: { min: 0.5, max: 12 },
      inland: { min: 3, max: 200 },
      surfaces: ["sand", "rock"],
      slope: 0.6,
      share: 1.2,
      patch: { scale: 38, over: 0.44 },
    },
  },
  {
    id: "lichen",
    name: "Orange lichen (Xanthoria)",
    biomes: ["arctic"],
    look: {
      // A skin of orange on the stones the birds sit on: the bush
      // builder at its flattest, in the one orange in the game.
      form: "bush",
      height: { min: 0.02, max: 0.04 },
      spread: 5,
      stems: 1,
      bare: 0,
      stem: 0x6a5a3a,
      leafLit: 0xd8902c,
      leafDark: 0x8a5a1c,
    },
    habitat: {
      ground: { min: 0.8, max: 20 },
      inland: { min: 2, max: 200 },
      surfaces: ["rock", "bedrock"],
      slope: 0.7,
      share: 1.5,
      patch: { scale: 34, over: 0.46 },
    },
  },
  {
    id: "snowbank",
    name: "Snow, lying in the hollows",
    biomes: ["arctic"],
    look: {
      // The cobble's builder wide and low and WHITE: a drift the wind left
      // in a hollow of the moraine, and up on the glacier's surface the
      // snow that never goes.
      form: "stone",
      height: { min: 0.3, max: 1 },
      spread: 3.6,
      stems: 1,
      bare: 0,
      stem: 0xdde6ee,
      leafLit: 0xf6f9fc,
      leafDark: 0xcfdbe6,
    },
    habitat: {
      ground: { min: 0.5, max: 45 },
      inland: { min: 4, max: 260 },
      surfaces: ["rock", "bedrock", "sand"],
      slope: 0.7,
      share: 2,
      patch: { scale: 30, over: 0.56 },
    },
  },
];
