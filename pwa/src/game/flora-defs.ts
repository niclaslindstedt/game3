// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SHORE'S COVER, AS DATA — one row per thing that grows on this coast,
// what it looks like and where it will stand. The mirror of the fauna's
// split: `engine/game/defs/fauna.ts` says what an animal IS and this says
// what a plant is, `flora-shapes.ts` builds it and `flora.ts` plants it.
//
// It is renderer-side because none of it is a solid — the hull rides
// through a reed bed and over a heather mat, and nothing in the engine has
// ever heard of either (the `nature` skill's line: what the renderer may
// place on its own is decoration that cannot be hit). The one row here
// that is not alive is the loose STONE, and it is here because a shingle
// bank is strewn over a shore by exactly the rules a stand of birch is:
// one placer, one density row, one pass.
//
// WHY THESE SPECIES. The coast is the Bothnian Sea's (`biomes.ts`), and a
// Baltic shore is not a wall of spruce — that is the picture of the taiga
// people carry inland. At the water it is a LADDER, and the ladder is what
// this roster is:
//
//   in the water    common reed (Phragmites australis) — the reed beds of
//                   the sheltered coves and, above all, the river's own
//                   margins: the thing that makes a mouth read as a delta
//   the wet margin  sedge and small-reed (Carex, Calamagrostis) in tussocks
//   the bank        grey alder (Alnus incana) and goat willow (Salix
//                   caprea) — the riparian pair, standing with their feet
//                   in the water, and the reason a riverbank is a darker,
//                   softer green than the slab behind it
//   the sand        lyme grass (Leymus arenarius), blue-green and tall
//   the shore       downy birch (Betula pubescens) — white trunks running
//                   right down to the waterline, and the single loudest
//                   thing that says NORTHERN rather than merely coniferous
//   the slabs       Scots pine (Pinus sylvestris) on the dry bedrock, its
//                   upper trunk orange; juniper and ling between them
//   behind it       Norway spruce (Picea abies) where the ground holds
//                   water, with aspen and rowan in the gaps
//   over the top    nothing: bare rock above `TREE_LINE`
//
// Kept free of three.js so `tests/flora_test.ts` can read the whole roster
// — the habitat bands are a claim about the coast, and a claim is worth
// holding.

import type { Surface } from "@engine";

/** The tree line, m above sea level: how high anything with a trunk gets
 * up a hill before the rock stands bare, which is what makes a rugged
 * headland (R21) read as rock rather than as a wooded ridge. Stated here
 * because `terrain.ts` paints the forest floor under exactly this line and
 * a second copy of the number is a shore whose paint and whose trees
 * disagree about where the wood stops. */
export const TREE_LINE = 20;

export type Band = { readonly min: number; readonly max: number };

/** How a species is BUILT (`flora-shapes.ts`). Seven shapes carry thirteen
 * species: what separates a birch from a rowan is its size, its bark and
 * its green, not another builder. */
export type FloraForm =
  /** A bare trunk with a broad, flat, high crown: the Scots pine. */
  | "pine"
  /** Stacked cones, boughs to the ground: the spruce. */
  | "spire"
  /** A trunk under a rounded crown: birch, aspen, alder, rowan. */
  | "broadleaf"
  /** No trunk worth the name — a mound of foliage: willow, juniper, ling. */
  | "bush"
  /** A clump of blades: the grasses and the sedge. */
  | "tuft"
  /** Tall straight stems under a plume: the reed. */
  | "reed"
  /** A cobble. */
  | "stone";

/** WHERE A SPECIES WILL STAND. Every band is read against the level's own
 * two fields, so a habitat is a claim about the ground rather than about a
 * place: it holds on any seed. */
export type Habitat = {
  /** Ground height against sea level, m. A minimum below zero reaches into
   * the water — which is where a reed bed lives. */
  readonly ground: Band;
  /** Metres LANDWARD of the water's edge (the offshore field, negated), so
   * a negative minimum is a stand out in the shallows. */
  readonly inland: Band;
  /** What the ground has to be made of (`level.materialAt`); a submerged
   * point classifies as `water`. Empty means it will take anything. */
  readonly surfaces: readonly Surface[];
  /** The steepest ground it holds on, as a gradient. Nothing much grows on
   * a slab standing at 45°, and a tree drawn plumb on one hangs in the
   * air. */
  readonly slope: number;
  /** Its share of the stand where it will grow at all — a weight against
   * every other species that can live at the same point, not a count. */
  readonly share: number;
  /** …and the share it takes instead within `within` metres of the RIVER's
   * line. This one field is the delta: the riparian species are ordinary
   * on the open coast and take the bank over when there is a bank. */
  readonly riverside?: { readonly within: number; readonly share: number };
  /** How much of a ring at `SHELTER_RING` metres has to be land before it
   * will grow, 0..1. Reed does not stand in surf: an exposed shore washes
   * a bed out, and a cove or a river mouth is where one survives. */
  readonly shelter?: number;
  /** The PATCH it comes in: it grows only where a value noise at `scale`
   * metres runs above `over`. Vegetation is patchy — a reed bed is a bed
   * and a heath is a heath — and a species scattered evenly over every
   * point that suits it reads as confetti. */
  readonly patch?: { readonly scale: number; readonly over: number };
};

/** WHAT A SPECIES LOOKS LIKE. Colours are plain hex so this module stays
 * three-free; `flora-shapes.ts` is where they become geometry. */
export type Look = {
  readonly form: FloraForm;
  /** Drawn height, m, tip to foot. */
  readonly height: Band;
  /** Plan width as a share of that height — what makes a juniper a column
   * and a willow a dome out of the same builder. */
  readonly spread: number;
  /** How many stems come out of the ground. Alder and willow are
   * multi-stemmed from a stool, which is most of how they read as
   * riverbank scrub rather than as small trees. */
  readonly stems: number;
  /** How much of the stem stands clear under the foliage, as a share of
   * the height. */
  readonly bare: number;
  /** The stem, and its upper reach where that differs: a Scots pine's
   * trunk goes copper-orange above the crown's shade, and the reed's stem
   * ends in a purple-brown plume. */
  readonly stem: number;
  readonly stemHigh?: number;
  /** The foliage, lit and shaded — one mixes into the other up the
   * canopy. */
  readonly leafLit: number;
  readonly leafDark: number;
};

export type FloraSpec = {
  readonly id: string;
  /** What it is, for anyone reading the table rather than the shore. */
  readonly name: string;
  readonly look: Look;
  readonly habitat: Habitat;
};

/** How far out the shelter ring is thrown, m. A cove that closes inside
 * fifty metres is a cove; one that does not is a bight the sea gets into. */
export const SHELTER_RING = 45;

/**
 * The taiga coast's roster, from the water up. Only coast built, so only
 * roster: when a second biome arrives this becomes a row per coast the way
 * `biomes.ts` is engine-side, and the ids here are what its row will name.
 */
export const FLORA: readonly FloraSpec[] = [
  {
    id: "reed",
    name: "Common reed (Phragmites australis)",
    look: {
      form: "reed",
      height: { min: 1.5, max: 2.4 },
      spread: 1.15,
      stems: 18,
      bare: 0,
      stem: 0xb0a068,
      // The plume: a reed bed's whole top surface is this dusty purple in
      // late summer, and at chase range it is the only part of a bed that
      // is not straw.
      stemHigh: 0x8a7566,
      leafLit: 0xc2b179,
      leafDark: 0x87794a,
    },
    habitat: {
      ground: { min: -1.3, max: 0.35 },
      inland: { min: -7, max: 2 },
      surfaces: [],
      slope: 0.3,
      // Rare on the open coast, and the bank of the river is a WALL of it:
      // a bed is a mass, and a share that only wins a third of the bank
      // draws isolated stems standing in open water, which reads as litter
      // rather than as a reed bed.
      share: 0.35,
      riverside: { within: 90, share: 18 },
      shelter: 0.3,
      patch: { scale: 95, over: 0.3 },
    },
  },
  {
    id: "sedge",
    name: "Sedge and small-reed (Carex, Calamagrostis)",
    look: {
      form: "tuft",
      height: { min: 0.4, max: 0.95 },
      spread: 1.05,
      stems: 17,
      bare: 0,
      stem: 0x6d7a3c,
      leafLit: 0x93a453,
      leafDark: 0x5c6a33,
    },
    habitat: {
      ground: { min: -0.35, max: 1.7 },
      inland: { min: -3, max: 24 },
      surfaces: [],
      slope: 0.45,
      share: 1.2,
      riverside: { within: 110, share: 5 },
      shelter: 0.16,
      patch: { scale: 58, over: 0.38 },
    },
  },
  {
    id: "lyme",
    name: "Lyme grass (Leymus arenarius)",
    look: {
      form: "tuft",
      height: { min: 0.5, max: 1.05 },
      spread: 0.9,
      stems: 15,
      bare: 0,
      stem: 0x8d9a78,
      // Blue-green rather than grass green: a dune grass is glaucous, and
      // it is the one green on this coast that reads cool against sand.
      leafLit: 0xa8b891,
      leafDark: 0x76875f,
    },
    habitat: {
      ground: { min: 0.35, max: 4.5 },
      inland: { min: 2, max: 50 },
      surfaces: ["sand"],
      slope: 0.5,
      share: 5,
      patch: { scale: 46, over: 0.33 },
    },
  },
  {
    id: "heather",
    name: "Ling (Calluna vulgaris)",
    look: {
      form: "bush",
      height: { min: 0.18, max: 0.4 },
      spread: 2.1,
      stems: 1,
      bare: 0,
      stem: 0x4a3b31,
      // In flower, which on this coast is most of the riding season.
      leafLit: 0x7b6069,
      leafDark: 0x40353c,
    },
    habitat: {
      ground: { min: 1.2, max: 26 },
      inland: { min: 8, max: 260 },
      surfaces: ["bedrock", "rock"],
      slope: 0.7,
      share: 4.6,
      patch: { scale: 40, over: 0.36 },
    },
  },
  {
    id: "juniper",
    name: "Common juniper (Juniperus communis)",
    look: {
      form: "bush",
      height: { min: 0.9, max: 3.2 },
      // Narrow: the same builder as the willow, and the spread is the only
      // difference between a column and a dome.
      spread: 0.36,
      stems: 1,
      bare: 0.04,
      stem: 0x4c4236,
      leafLit: 0x3c5a41,
      leafDark: 0x1e3324,
    },
    habitat: {
      ground: { min: 1, max: 24 },
      inland: { min: 6, max: 260 },
      surfaces: ["bedrock", "rock"],
      slope: 0.62,
      share: 1.7,
      patch: { scale: 52, over: 0.3 },
    },
  },
  {
    id: "willow",
    name: "Goat willow and sallow (Salix)",
    look: {
      form: "bush",
      height: { min: 2.2, max: 5.5 },
      spread: 0.95,
      stems: 1,
      bare: 0.14,
      stem: 0x6a6250,
      // Grey-green: a sallow is the softest, palest green on the bank.
      leafLit: 0x86996c,
      leafDark: 0x4a5c42,
    },
    habitat: {
      ground: { min: 0.1, max: 3.6 },
      inland: { min: 0.5, max: 42 },
      surfaces: [],
      slope: 0.5,
      share: 0.5,
      riverside: { within: 100, share: 4 },
    },
  },
  {
    id: "alder",
    name: "Grey alder (Alnus incana)",
    look: {
      form: "broadleaf",
      height: { min: 5, max: 10.5 },
      spread: 0.78,
      // From a stool, leaning apart: the riverbank tree's whole silhouette.
      stems: 3,
      bare: 0.18,
      stem: 0x6d6457,
      leafLit: 0x4d7d46,
      leafDark: 0x2a4a2c,
    },
    habitat: {
      ground: { min: 0.2, max: 4.8 },
      inland: { min: 1, max: 58 },
      surfaces: [],
      slope: 0.55,
      share: 0.55,
      riverside: { within: 120, share: 3.2 },
    },
  },
  {
    id: "birch",
    name: "Downy birch (Betula pubescens)",
    look: {
      form: "broadleaf",
      height: { min: 6, max: 13.5 },
      spread: 0.58,
      stems: 1,
      bare: 0.34,
      // The white trunk. Against the pines behind it this is the single
      // most legible thing on the shore at any distance.
      stem: 0xe6e2d8,
      leafLit: 0x8ab355,
      leafDark: 0x4e7534,
    },
    habitat: {
      ground: { min: 0.6, max: TREE_LINE },
      inland: { min: 3, max: 260 },
      surfaces: ["sand", "bedrock", "rock"],
      slope: 0.6,
      share: 2.5,
      riverside: { within: 120, share: 3.4 },
    },
  },
  {
    id: "aspen",
    name: "European aspen (Populus tremula)",
    look: {
      form: "broadleaf",
      height: { min: 8, max: 15 },
      spread: 0.54,
      stems: 1,
      bare: 0.4,
      stem: 0xb5baa4,
      leafLit: 0x97bb60,
      leafDark: 0x577a3c,
    },
    habitat: {
      ground: { min: 1.5, max: TREE_LINE },
      inland: { min: 14, max: 260 },
      surfaces: ["bedrock", "rock"],
      slope: 0.55,
      share: 0.9,
      patch: { scale: 88, over: 0.34 },
    },
  },
  {
    id: "rowan",
    name: "Rowan (Sorbus aucuparia)",
    look: {
      form: "broadleaf",
      height: { min: 3.5, max: 7 },
      spread: 0.72,
      stems: 2,
      bare: 0.24,
      stem: 0x7d7466,
      leafLit: 0x71a04c,
      leafDark: 0x3f5f30,
    },
    habitat: {
      ground: { min: 1, max: TREE_LINE },
      inland: { min: 6, max: 260 },
      surfaces: ["bedrock", "rock"],
      slope: 0.72,
      share: 0.7,
    },
  },
  {
    id: "pine",
    name: "Scots pine (Pinus sylvestris)",
    look: {
      form: "pine",
      height: { min: 9, max: 18 },
      spread: 0.48,
      stems: 1,
      bare: 0.6,
      stem: 0x5a4530,
      // The copper upper trunk. It is what tells a Scots pine from every
      // other conifer at a glance, and on a low evening it is the warmest
      // thing on the shore.
      stemHigh: 0xa96a3c,
      leafLit: 0x3f6d43,
      leafDark: 0x23422b,
    },
    habitat: {
      ground: { min: 1.4, max: TREE_LINE },
      inland: { min: 12, max: 260 },
      surfaces: ["bedrock"],
      slope: 0.6,
      share: 2.3,
    },
  },
  {
    id: "spruce",
    name: "Norway spruce (Picea abies)",
    look: {
      form: "spire",
      height: { min: 8, max: 19 },
      spread: 0.34,
      stems: 1,
      bare: 0.05,
      stem: 0x4a3a2c,
      leafLit: 0x2d5537,
      leafDark: 0x14301e,
    },
    habitat: {
      // Behind the shore: a spruce wants ground that holds water, and the
      // bare slab at the waterline is the last place on this coast that
      // does. Keeping it back is what leaves the pines and the birch to
      // stand on the skyline where the rider actually looks.
      ground: { min: 1.8, max: TREE_LINE },
      inland: { min: 32, max: 260 },
      surfaces: ["bedrock", "rock"],
      slope: 0.6,
      share: 1.9,
      patch: { scale: 96, over: 0.3 },
    },
  },
  {
    id: "stone",
    name: "Shingle and loose stone",
    look: {
      form: "stone",
      height: { min: 0.18, max: 0.85 },
      spread: 1.6,
      stems: 1,
      bare: 0,
      stem: 0x7c8188,
      leafLit: 0x8d9298,
      leafDark: 0x5f656c,
    },
    habitat: {
      // Across the waterline and a little either side of it: a shingle
      // bank is the one bit of cover that does not care whether it is wet.
      ground: { min: -0.9, max: 3.4 },
      inland: { min: -8, max: 28 },
      surfaces: [],
      slope: 0.8,
      share: 3,
      patch: { scale: 34, over: 0.34 },
    },
  },
];
