// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE KARST COAST'S COVER — the fourth quarter of the roster. It lives
// beside `flora-defs.ts` for the reason `flora-defs-arctic.ts` does: one
// subject, one placer, one lab, and a parent file past the §20.5 cap.
// `FLORA` is still how the whole app spells the roster — `flora-defs.ts`
// spreads these rows onto the end of it — and nothing anywhere reads this
// module directly. What a row MEANS (the look, the habitat, the forms) is
// stated there and not repeated here.
//
// A LIMESTONE COAST IS SCRUB, NOT FOREST. The hills were cut for ships and
// grazed to the rock, and what grows back on a dry slab in a dry summer is
// the maquis: a knee-to-head-high scrub of grey-green aromatic bushes —
// sage, rosemary, immortelle, rockrose — with the dark domes of myrtle and
// the yellow-green of the tree spurge over the cliffs, and over that the
// pine that leans out over the water, the holm oak in the hollows where
// the red soil is, the olive on its terraces, and the cypress standing up
// black out of all of it like an exclamation mark. Under the water, over
// the pale rock, the seagrass meadow that is the reason the bays are the
// colour they are; along the river's gorge the giant reed and the pink of
// the oleander. The ladder itself is in `flora-defs.ts`'s header with the
// other three coasts'.

import type { FloraSpec } from "./flora-defs.ts";

/** The karst's rows, given the tree line — handed in rather than imported,
 * because `flora-defs.ts` states it and spreads these rows, and a module
 * that imports the file that imports it reads the line as nothing. */
export const karstFlora = (TREE_LINE: number): readonly FloraSpec[] => [
  {
    id: "posidonia",
    name: "Neptune grass (Posidonia oceanica)",
    biomes: ["karst"],
    look: {
      // A meadow of strap leaves a metre long standing up off the rock
      // and laid over by the swell: the reed's builder, dark green, under
      // the water — the thing the eye reads through thirty metres of it.
      form: "reed",
      height: { min: 0.5, max: 1.1 },
      spread: 1.0,
      stems: 22,
      bare: 0,
      stem: 0x2e5a3a,
      stemHigh: 0x3a6a44,
      leafLit: 0x4a8a50,
      leafDark: 0x1e4a2c,
    },
    habitat: {
      // Wholly under the water, from a metre and a half down to where
      // the light runs out on the rock off a cove: its crown never breaks
      // the surface.
      ground: { min: -8, max: -1.5 },
      inland: { min: -60, max: -4 },
      surfaces: [],
      slope: 0.45,
      share: 1.6,
      patch: { scale: 70, over: 0.3 },
    },
  },
  {
    id: "pebble",
    name: "White pebbles (limestone shingle)",
    biomes: ["karst"],
    look: {
      // The cobble's builder small and WHITE: a cove here is a bank of
      // limestone worn round, so pale the tideline reads as a strip of
      // snow under the pines.
      form: "stone",
      height: { min: 0.08, max: 0.35 },
      spread: 1.6,
      stems: 1,
      bare: 0,
      stem: 0xd6d0c2,
      leafLit: 0xece8dc,
      leafDark: 0xb8b2a2,
    },
    habitat: {
      ground: { min: -0.8, max: 2.5 },
      inland: { min: -6, max: 20 },
      surfaces: [],
      slope: 0.8,
      share: 3,
      patch: { scale: 34, over: 0.36 },
    },
  },
  {
    id: "samphire",
    name: "Rock samphire (Crithmum maritimum)",
    biomes: ["karst"],
    look: {
      // A fleshy grey-green tuft growing out of the bare rock a hand over
      // the spray: the first thing that lives above the black lichen band,
      // and the only green on the slab at the waterline.
      form: "tuft",
      height: { min: 0.2, max: 0.45 },
      spread: 1.1,
      stems: 12,
      bare: 0,
      stem: 0x7a8a6a,
      leafLit: 0xa0b088,
      leafDark: 0x627454,
    },
    habitat: {
      ground: { min: 0.3, max: 4 },
      inland: { min: 1, max: 25 },
      surfaces: ["bedrock", "rock"],
      slope: 0.8,
      share: 2.5,
      patch: { scale: 30, over: 0.34 },
    },
  },
  {
    id: "arundo",
    name: "Giant reed (Arundo donax)",
    biomes: ["karst"],
    look: {
      // The reed at three times the taiga's height: a cane as tall as a
      // house, in a wall along the gorge's floor, straw-green with a
      // silver plume.
      form: "reed",
      height: { min: 3, max: 5 },
      spread: 0.9,
      stems: 16,
      bare: 0,
      stem: 0xa8a870,
      stemHigh: 0xc8c4b0,
      leafLit: 0xa8b870,
      leafDark: 0x6a7a44,
    },
    habitat: {
      // The river's bank and nowhere else worth the name: a reed bed here
      // is a gorge's floor, and the open coast is too dry for it.
      ground: { min: -0.3, max: 3 },
      inland: { min: -2, max: 30 },
      surfaces: [],
      slope: 0.35,
      share: 0.2,
      riverside: { within: 100, share: 12 },
      shelter: 0.2,
      patch: { scale: 80, over: 0.3 },
    },
  },
  {
    id: "oleander",
    name: "Oleander (Nerium oleander)",
    biomes: ["karst"],
    look: {
      // PINK, all summer: a dome of dark leaves flowering pink along
      // every dry riverbed on the coast, and the one colour in the gorge.
      form: "bush",
      height: { min: 1.5, max: 3.5 },
      spread: 1.0,
      stems: 1,
      bare: 0.08,
      stem: 0x6a5a4a,
      leafLit: 0xd88aa0,
      leafDark: 0x3e5a3c,
    },
    habitat: {
      ground: { min: 0.2, max: 4 },
      inland: { min: 1, max: 40 },
      surfaces: [],
      slope: 0.5,
      share: 0.2,
      riverside: { within: 90, share: 6 },
    },
  },
  {
    id: "immortelle",
    name: "Immortelle (Helichrysum italicum)",
    biomes: ["karst"],
    look: {
      // Silver-grey, and yellow in flower: a low cushion of it over every
      // sunny slab, and the smell of the whole coast in July.
      form: "bush",
      height: { min: 0.2, max: 0.5 },
      spread: 1.8,
      stems: 1,
      bare: 0,
      stem: 0x8a8a70,
      leafLit: 0xd8c860,
      leafDark: 0x9a9a7a,
    },
    habitat: {
      ground: { min: 0.5, max: 26 },
      inland: { min: 4, max: 260 },
      surfaces: ["rock", "bedrock", "sand"],
      slope: 0.7,
      share: 3.5,
      patch: { scale: 40, over: 0.34 },
    },
  },
  {
    id: "sage",
    name: "Sage (Salvia officinalis)",
    biomes: ["karst"],
    look: {
      // Grey-green and felted, knee high, in drifts across the bare hill:
      // the maquis at its lowest and its greyest.
      form: "bush",
      height: { min: 0.3, max: 0.7 },
      spread: 1.6,
      stems: 1,
      bare: 0,
      stem: 0x6a6a5a,
      leafLit: 0x9aa88a,
      leafDark: 0x5e6e58,
    },
    habitat: {
      ground: { min: 0.8, max: 26 },
      inland: { min: 6, max: 260 },
      surfaces: ["rock", "bedrock"],
      slope: 0.7,
      share: 3,
      patch: { scale: 44, over: 0.36 },
    },
  },
  {
    id: "rosemary",
    name: "Rosemary (Salvia rosmarinus)",
    biomes: ["karst"],
    look: {
      // Dark green, blue in flower, waist high on the slopes over the
      // coves, growing straight out of the cracks in the rock.
      form: "bush",
      height: { min: 0.5, max: 1.5 },
      spread: 1.3,
      stems: 1,
      bare: 0.04,
      stem: 0x5a5a48,
      leafLit: 0x6a8a6a,
      leafDark: 0x34503a,
    },
    habitat: {
      ground: { min: 0.6, max: 24 },
      inland: { min: 4, max: 260 },
      surfaces: ["rock", "bedrock"],
      slope: 0.7,
      share: 2.5,
      patch: { scale: 48, over: 0.34 },
    },
  },
  {
    id: "rockrose",
    name: "Rockrose (Cistus)",
    biomes: ["karst"],
    look: {
      // A grey-green bush that flowers pink and white in the spring so
      // thickly the hill goes pale: the maquis's flower.
      form: "bush",
      height: { min: 0.4, max: 1 },
      spread: 1.5,
      stems: 1,
      bare: 0,
      stem: 0x6a6050,
      leafLit: 0xd0a8b4,
      leafDark: 0x6a7a5a,
    },
    habitat: {
      ground: { min: 0.8, max: 24 },
      inland: { min: 6, max: 260 },
      surfaces: ["rock", "bedrock", "sand"],
      slope: 0.65,
      share: 2.5,
      patch: { scale: 52, over: 0.38 },
    },
  },
  {
    id: "spurge",
    name: "Tree spurge (Euphorbia dendroides)",
    biomes: ["karst"],
    look: {
      // A perfect dome of yellow-green on the sea cliffs, brightest in
      // the spring and rust-red by August: the one plant that stands on
      // the steepest rock above the water, and it reads from the sea.
      form: "bush",
      height: { min: 1, max: 2.5 },
      spread: 1.3,
      stems: 1,
      bare: 0.1,
      stem: 0x7a6a50,
      leafLit: 0xc0c850,
      leafDark: 0x6a7a30,
    },
    habitat: {
      ground: { min: 1, max: 32 },
      inland: { min: 3, max: 120 },
      surfaces: ["bedrock", "rock"],
      slope: 0.85,
      share: 1.5,
      patch: { scale: 46, over: 0.4 },
    },
  },
  {
    id: "myrtle",
    name: "Myrtle (Myrtus communis)",
    biomes: ["karst"],
    look: {
      // Dark, glossy and dense, head high: the tall maquis, and the dark
      // green the grey scrub is read against.
      form: "bush",
      height: { min: 1.5, max: 3 },
      spread: 1.0,
      stems: 1,
      bare: 0.06,
      stem: 0x5a4a3a,
      leafLit: 0x4a7a44,
      leafDark: 0x203e28,
    },
    habitat: {
      ground: { min: 1, max: TREE_LINE },
      inland: { min: 8, max: 260 },
      surfaces: ["bedrock", "rock", "bank"],
      slope: 0.6,
      share: 1.5,
      patch: { scale: 56, over: 0.36 },
    },
  },
  {
    id: "pricklyjuniper",
    name: "Prickly juniper (Juniperus oxycedrus)",
    biomes: ["karst"],
    look: {
      // The taiga's juniper's builder, taller and a warmer green, in a
      // column on the rock: the one conifer of the scrub.
      form: "bush",
      height: { min: 1.5, max: 5 },
      spread: 0.42,
      stems: 1,
      bare: 0.06,
      stem: 0x6a5a48,
      leafLit: 0x5a7a48,
      leafDark: 0x2c4a2e,
    },
    habitat: {
      ground: { min: 1, max: 26 },
      inland: { min: 6, max: 260 },
      surfaces: ["bedrock", "rock"],
      slope: 0.65,
      share: 1.5,
      patch: { scale: 50, over: 0.34 },
    },
  },
  {
    id: "holmoak",
    name: "Holm oak (Quercus ilex)",
    biomes: ["karst"],
    look: {
      // A round, dark, dense crown on a short grey trunk: the tree the
      // whole coast was once under, and the darkest green on it now, in
      // the hollows where the red soil has collected.
      form: "broadleaf",
      height: { min: 5, max: 12 },
      spread: 0.95,
      stems: 1,
      bare: 0.26,
      stem: 0x5a5248,
      leafLit: 0x4a7040,
      leafDark: 0x22402a,
    },
    habitat: {
      ground: { min: 1.5, max: TREE_LINE },
      inland: { min: 12, max: 260 },
      surfaces: ["bedrock", "rock", "bank"],
      slope: 0.55,
      share: 1.6,
      patch: { scale: 90, over: 0.36 },
    },
  },
  {
    id: "olive",
    name: "Olive (Olea europaea)",
    biomes: ["karst"],
    look: {
      // Silver-grey — an olive's leaves are pale underneath and the wind
      // turns them — low, wide and gnarled, from a stool of two or three
      // trunks: the pale tree among the dark ones, in groves on the
      // easier ground.
      form: "broadleaf",
      height: { min: 3, max: 7 },
      spread: 1.1,
      stems: 2,
      bare: 0.28,
      stem: 0x7a7060,
      leafLit: 0xa0aa80,
      leafDark: 0x5e6a4a,
    },
    habitat: {
      ground: { min: 1.5, max: TREE_LINE },
      inland: { min: 14, max: 260 },
      surfaces: ["bedrock", "rock"],
      slope: 0.5,
      share: 1.2,
      patch: { scale: 80, over: 0.42 },
    },
  },
  {
    id: "cypress",
    name: "Cypress (Cupressus sempervirens)",
    biomes: ["karst"],
    look: {
      // THE EXCLAMATION MARK: a spire as narrow as a mast and nearly
      // black, standing up out of the scrub and the pines singly and in
      // twos and threes, and the single most legible thing on this shore
      // at any distance — nothing else on any coast is this shape.
      form: "spire",
      height: { min: 8, max: 20 },
      spread: 0.16,
      stems: 1,
      bare: 0.04,
      stem: 0x4a3a2c,
      leafLit: 0x2c4a30,
      leafDark: 0x12281a,
    },
    habitat: {
      ground: { min: 1.5, max: TREE_LINE },
      inland: { min: 10, max: 260 },
      surfaces: ["bedrock", "rock", "bank"],
      slope: 0.6,
      share: 0.5,
      patch: { scale: 60, over: 0.5 },
    },
  },
  {
    id: "coastpine",
    name: "Coastal pine (Pinus halepensis)",
    biomes: ["karst"],
    look: {
      // The pine that LEANS OUT OVER THE WATER: a pale grey trunk, an
      // open irregular crown of a light, yellowish green — paler than any
      // northern conifer — growing out of the bare slab right down to the
      // spray. The tree that says this coast from the sea.
      form: "pine",
      height: { min: 8, max: 18 },
      spread: 0.62,
      stems: 1,
      bare: 0.5,
      stem: 0x8a8278,
      stemHigh: 0x9c9284,
      leafLit: 0x74a058,
      leafDark: 0x3c6238,
    },
    habitat: {
      ground: { min: 1.2, max: TREE_LINE },
      inland: { min: 6, max: 260 },
      surfaces: ["bedrock", "rock", "sand"],
      slope: 0.65,
      share: 2.6,
    },
  },
];
