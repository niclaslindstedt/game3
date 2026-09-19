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
// WHY THESE SPECIES, AND WHY FOUR ROSTERS. A coast is what grows on it as
// much as what it is made of, and the four coasts this game builds grow
// nothing in common. Each row says which coasts it belongs to (`biomes`),
// the placer plants only the rows of the coast it is on, and the four
// ladders are these:
//
// THE TAIGA COAST — a northern shore is not a wall of spruce; that is the
// picture people carry inland. At the water it is a LADDER:
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
// THE ARCTIC COAST — a polar shore has NO TREES and NO STONE, and its
// ladder is a few centimetres high: everything on it grows flat to the
// ground out of the wind, in cushions and mats in the firn, and what
// stands up over the rider's head is ICE, not wood.
//
//   in the water    kelp (Laminaria) on the bed under the front
//   the tideline    stranded ice — bergy bits and floes the tide left on
//                   the firn, the one thing on the shore taller than a man
//   the wet ground  cotton grass (Eriophorum) in white tufts, and the moss
//                   mat, thickest along the crack's melt
//   the firn        purple saxifrage (Saxifraga oppositifolia) and moss
//                   campion (Silene acaulis) in cushions, polar willow
//                   (Salix polaris) an inch high, mountain avens (Dryas)
//                   in mats, the yellow poppy (Papaver) on the barest firn
//   the hollows     snow, wherever the wind cannot reach
//   over the top    the ice
//
// THE MANGROVE COAST — a low warm shore, and its ladder is shorter because
// the land is: nothing stands twenty metres over this water.
//
//   in the water    red mangrove (Rhizophora mangle) on its prop roots —
//                   the tree that stands IN the sea, and the thing that
//                   makes a sheltered point or a river mouth read as this
//                   coast at all
//   the wet margin  cordgrass (Spartina) in the mud behind it
//   the mud         black mangrove (Avicennia germinans), a shrubby dark
//                   wall on the marl behind the red
//   the dune        sea oats (Uniola paniculata) and sea grape (Coccoloba
//                   uvifera) on the white sand, and the coconut palm
//                   leaning over the beach
//   the shore       cabbage palm (Sabal palmetto) — the fan palm that says
//                   this coast from any distance — with saw palmetto
//                   (Serenoa repens) thick under it
//   behind it       slash pine (Pinus elliottii), tall and thin-crowned,
//                   and live oak (Quercus virginiana) spreading low and
//                   wide where the ground is a little higher
//   underfoot       shell and coral rubble at the tideline
//
// THE KARST COAST — a limestone shore is SCRUB, not forest: the hills were
// cut and grazed to the rock, and what grows on a dry slab is the maquis,
// grey-green and aromatic, with a few trees standing up out of it.
//
//   in the water    Neptune grass (Posidonia) — the seagrass meadow over
//                   the pale rock that is the reason the bays are blue
//   the tideline    white limestone pebbles, the shingle of the coves
//   the spray zone  rock samphire, a fleshy tuft out of the bare slab
//   the gorge       giant reed (Arundo) in a wall, and the oleander
//                   flowering pink along the river — the coast's bank
//   the slab        immortelle, sage, rosemary and rockrose: the low
//                   maquis, knee high, grey and in flower
//   the cliffs      tree spurge, a yellow-green dome on the steepest rock
//   the scrub       myrtle and prickly juniper, head high and dark
//   the shore       the coastal pine (Pinus halepensis), pale and open,
//                   leaning out over the water off the slab
//   the hollows     holm oak on the red soil, the olive on its terraces
//   standing up     the cypress — a black spire, and nothing else on any
//                   coast is that shape
//   over the top    bare white rock above `TREE_LINE`
//
// Kept free of three.js so `tests/flora_test.ts` can read the whole roster
// — the habitat bands are a claim about the coast, and a claim is worth
// holding.

import type { BiomeId, Surface } from "@engine";

import { ARCTIC_FLORA } from "./flora-defs-arctic.ts";
import { karstFlora } from "./flora-defs-karst.ts";

/** The tree line, m above sea level: how high anything with a trunk gets
 * up a hill before the rock stands bare, which is what makes a rugged
 * headland (R21) read as rock rather than as a wooded ridge. Stated here
 * because `terrain.ts` paints the forest floor under exactly this line and
 * a second copy of the number is a shore whose paint and whose trees
 * disagree about where the wood stops. */
export const TREE_LINE = 20;

export type Band = { readonly min: number; readonly max: number };

/** How a species is BUILT (`flora-shapes.ts`). Nine shapes carry four
 * rosters: what separates a birch from a rowan is its size, its bark and
 * its green, not another builder — what separates a cabbage palm from a
 * coconut is the count and reach of its fronds, a spruce from a cypress
 * its spread — and what separates a cobble from a stranded floe is its
 * size and its white. */
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
  /** A bare trunk under a crown of arching fronds: the palms. `stems` is
   * the frond count and `spread` their reach. */
  | "palm"
  /** A dome of foliage stood up on a ring of prop roots, its feet in the
   * water: the red mangrove. `stems` is the root count. */
  | "mangrove"
  /** A cobble, or a heap of shell. */
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
  /** WHICH COASTS IT GROWS ON — ids from `engine/mapgen/biomes.ts`. The
   * placer plants only the rows of the coast it is on, so a row is a claim
   * about a kind of shore rather than about every shore. */
  readonly biomes: readonly BiomeId[];
  readonly look: Look;
  readonly habitat: Habitat;
};

/** How far out the shelter ring is thrown, m. A cove that closes inside
 * fifty metres is a cove; one that does not is a bight the sea gets into. */
export const SHELTER_RING = 45;

/** The rows a bird will perch in: the tall trees of the wooded coasts, read
 * by `bird-plan.ts`'s `treePerches`. Here because it names rows of this
 * table. */
export const PERCH_TREES = [
  "pine",
  "spruce",
  "birch",
  "aspen",
  "slashpine",
  "sabal",
  "coconut",
  "liveoak",
  "coastpine",
  "cypress",
  "holmoak",
];

/** The rows a coast plants, in roster order — what the placer, the lab and
 * the tests walk for a level. */
export function floraOf(biome: BiomeId): readonly FloraSpec[] {
  return FLORA.filter((s) => s.biomes.includes(biome));
}

/**
 * Every coast's roster, from the water up, the taiga's first. ONE list
 * rather than one per coast because everything that indexes a stand — the
 * placer's spots, the wiring's meshes, the perches the birds read — indexes
 * this list, and a row's place in it is its identity.
 */
export const FLORA: readonly FloraSpec[] = [
  {
    id: "reed",
    name: "Common reed (Phragmites australis)",
    biomes: ["taiga"],
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
    biomes: ["taiga"],
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
    biomes: ["taiga"],
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
    biomes: ["taiga"],
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
    biomes: ["taiga"],
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
    biomes: ["taiga"],
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
    biomes: ["taiga"],
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
    biomes: ["taiga"],
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
      surfaces: ["sand", "bedrock", "rock", "bank"],
      slope: 0.6,
      share: 2.5,
      riverside: { within: 120, share: 3.4 },
    },
  },
  {
    id: "aspen",
    name: "European aspen (Populus tremula)",
    biomes: ["taiga"],
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
      surfaces: ["bedrock", "rock", "bank"],
      slope: 0.55,
      share: 0.9,
      patch: { scale: 88, over: 0.34 },
    },
  },
  {
    id: "rowan",
    name: "Rowan (Sorbus aucuparia)",
    biomes: ["taiga"],
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
      surfaces: ["bedrock", "rock", "bank"],
      slope: 0.72,
      share: 0.7,
    },
  },
  {
    id: "pine",
    name: "Scots pine (Pinus sylvestris)",
    biomes: ["taiga"],
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
    biomes: ["taiga"],
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
      surfaces: ["bedrock", "rock", "bank"],
      slope: 0.6,
      share: 1.9,
      patch: { scale: 96, over: 0.3 },
    },
  },
  {
    id: "stone",
    name: "Shingle and loose stone",
    biomes: ["taiga"],
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
  // ── The mangrove coast ────────────────────────────────────────────────
  {
    id: "redmangrove",
    name: "Red mangrove (Rhizophora mangle)",
    biomes: ["mangrove"],
    look: {
      form: "mangrove",
      height: { min: 3, max: 7 },
      spread: 1.1,
      // The prop roots: the arch of them is the whole silhouette at the
      // waterline, and eight is a thicket rather than a tree on stilts.
      stems: 8,
      bare: 0.3,
      stem: 0x6a5648,
      leafLit: 0x4f8a3f,
      leafDark: 0x24502a,
    },
    habitat: {
      // Its feet in the sea: the one tree in either roster that stands in
      // water, and it stands nowhere else.
      ground: { min: -0.7, max: 0.8 },
      inland: { min: -7, max: 14 },
      surfaces: [],
      slope: 0.4,
      // Rare on the open beach, and the bank of the river and the lee of a
      // point are a WALL of it: the reed's share, for the reed's reason.
      share: 0.4,
      riverside: { within: 110, share: 14 },
      shelter: 0.22,
      patch: { scale: 80, over: 0.28 },
    },
  },
  {
    id: "cordgrass",
    name: "Cordgrass (Spartina)",
    biomes: ["mangrove"],
    look: {
      form: "tuft",
      height: { min: 0.5, max: 1.3 },
      spread: 1.0,
      stems: 16,
      bare: 0,
      stem: 0x8a9a5a,
      leafLit: 0xa3b36a,
      leafDark: 0x66743e,
    },
    habitat: {
      ground: { min: -0.3, max: 1.2 },
      inland: { min: -3, max: 20 },
      surfaces: [],
      slope: 0.4,
      share: 1.4,
      riverside: { within: 100, share: 4 },
      shelter: 0.14,
      patch: { scale: 55, over: 0.36 },
    },
  },
  {
    id: "blackmangrove",
    name: "Black mangrove (Avicennia germinans)",
    biomes: ["mangrove"],
    look: {
      form: "broadleaf",
      height: { min: 4, max: 9 },
      spread: 0.9,
      stems: 2,
      bare: 0.2,
      stem: 0x4a4038,
      // Darker and greyer than the red in front of it.
      leafLit: 0x5e8f4c,
      leafDark: 0x2f5232,
    },
    habitat: {
      // On the marl behind the red mangrove and up the river's mud, never
      // on the open beach.
      ground: { min: 0.1, max: 2.5 },
      inland: { min: 2, max: 40 },
      surfaces: ["bedrock", "bank"],
      slope: 0.45,
      share: 1.2,
      riverside: { within: 110, share: 3 },
      shelter: 0.15,
    },
  },
  {
    id: "seaoats",
    name: "Sea oats (Uniola paniculata)",
    biomes: ["mangrove"],
    look: {
      form: "tuft",
      height: { min: 0.8, max: 1.6 },
      spread: 0.8,
      stems: 14,
      bare: 0,
      stem: 0xb8a86c,
      // Straw-gold in the seed heads: the dune's own colour against white
      // sand, and the mangrove coast's lyme grass.
      leafLit: 0xc9b97a,
      leafDark: 0x8a8452,
    },
    habitat: {
      ground: { min: 0.3, max: 5 },
      inland: { min: 1, max: 45 },
      surfaces: ["sand"],
      slope: 0.5,
      share: 5,
      patch: { scale: 40, over: 0.3 },
    },
  },
  {
    id: "seagrape",
    name: "Sea grape (Coccoloba uvifera)",
    biomes: ["mangrove"],
    look: {
      form: "bush",
      height: { min: 1.5, max: 4 },
      spread: 1.3,
      stems: 1,
      bare: 0.06,
      stem: 0x6a5a4a,
      leafLit: 0x7fa354,
      leafDark: 0x3e6634,
    },
    habitat: {
      ground: { min: 0.4, max: 6 },
      inland: { min: 2, max: 60 },
      surfaces: ["sand"],
      slope: 0.5,
      share: 2.2,
      patch: { scale: 50, over: 0.32 },
    },
  },
  {
    id: "palmetto",
    name: "Saw palmetto (Serenoa repens)",
    biomes: ["mangrove"],
    look: {
      form: "bush",
      height: { min: 1, max: 2.5 },
      spread: 1.6,
      stems: 1,
      bare: 0,
      stem: 0x5a5040,
      leafLit: 0x5f8f4a,
      leafDark: 0x2f5230,
    },
    habitat: {
      ground: { min: 0.8, max: TREE_LINE },
      inland: { min: 8, max: 260 },
      surfaces: ["bedrock", "sand"],
      slope: 0.6,
      share: 4,
      patch: { scale: 45, over: 0.34 },
    },
  },
  {
    id: "coconut",
    name: "Coconut palm (Cocos nucifera)",
    biomes: ["mangrove"],
    look: {
      form: "palm",
      height: { min: 10, max: 20 },
      // Long feather fronds reaching well out from a leaning trunk.
      spread: 0.55,
      stems: 9,
      bare: 0.8,
      stem: 0x9a8a72,
      leafLit: 0x7fa64a,
      leafDark: 0x3f6a30,
    },
    habitat: {
      // The beach itself: a coconut grows where it washed up.
      ground: { min: 0.5, max: 6 },
      inland: { min: 3, max: 70 },
      surfaces: ["sand"],
      slope: 0.5,
      share: 1.6,
    },
  },
  {
    id: "sabal",
    name: "Cabbage palm (Sabal palmetto)",
    biomes: ["mangrove"],
    look: {
      form: "palm",
      height: { min: 8, max: 15 },
      // A fan palm: more fronds, shorter, in a rounder head.
      spread: 0.42,
      stems: 11,
      bare: 0.72,
      stem: 0x8a7c66,
      leafLit: 0x6f9a47,
      leafDark: 0x3a5f2e,
    },
    habitat: {
      ground: { min: 0.8, max: TREE_LINE },
      inland: { min: 6, max: 260 },
      surfaces: ["sand", "bedrock"],
      slope: 0.6,
      share: 2.4,
    },
  },
  {
    id: "liveoak",
    name: "Live oak (Quercus virginiana)",
    biomes: ["mangrove"],
    look: {
      form: "broadleaf",
      height: { min: 6, max: 14 },
      // Wider than it is tall: the spreading low crown is the tree.
      spread: 1.1,
      stems: 1,
      bare: 0.28,
      stem: 0x5a5048,
      leafLit: 0x5a8a45,
      leafDark: 0x2a4d2c,
    },
    habitat: {
      ground: { min: 1.2, max: TREE_LINE },
      inland: { min: 12, max: 260 },
      surfaces: ["bedrock", "bank"],
      slope: 0.55,
      share: 1.4,
      patch: { scale: 90, over: 0.32 },
    },
  },
  {
    id: "slashpine",
    name: "Slash pine (Pinus elliottii)",
    biomes: ["mangrove"],
    look: {
      form: "pine",
      height: { min: 12, max: 24 },
      // Tall and thin: a flatwoods pine carries a small crown on a long
      // trunk, and reads as a mast beside the palms.
      spread: 0.36,
      stems: 1,
      bare: 0.66,
      stem: 0x5a4535,
      stemHigh: 0x8a6a4a,
      leafLit: 0x4a7a44,
      leafDark: 0x27482c,
    },
    habitat: {
      ground: { min: 1.5, max: TREE_LINE },
      inland: { min: 20, max: 260 },
      surfaces: ["bedrock"],
      slope: 0.6,
      share: 1.8,
    },
  },
  {
    id: "shell",
    name: "Shell and coral rubble",
    biomes: ["mangrove"],
    look: {
      form: "stone",
      height: { min: 0.12, max: 0.5 },
      spread: 1.6,
      stems: 1,
      bare: 0,
      stem: 0xd8d0bc,
      // Bleached: the one thing on the tideline paler than the sand.
      leafLit: 0xe8e0cc,
      leafDark: 0xb8b09c,
    },
    habitat: {
      ground: { min: -0.6, max: 2.5 },
      inland: { min: -6, max: 25 },
      surfaces: [],
      slope: 0.8,
      share: 1.6,
      patch: { scale: 34, over: 0.4 },
    },
  },
  ...ARCTIC_FLORA,
  ...karstFlora(TREE_LINE),
];
