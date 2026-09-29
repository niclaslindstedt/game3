// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TREES, AS DATA — every row of the cover roster that is a TREE (a trunk
// under a crown: the pines, the spires, the broadleaves, the palms and the
// mangrove on its roots), the numbers the code's builder (`flora-shapes.ts`)
// draws each FORM with, the silhouette that makes (`crownAt`), and SIX
// VARIANTS of every kind, which is what the Blender builder models
// (`scripts/blender/tree.py`, handed all of it as one JSON file by `make
// blender KIND=tree`) and what `flora.ts` stands a coast's woods out of when
// the models are drawn (`tree-models.ts`). Three-free, so the suite, the
// driver and the stamp read every row.
//
// WHY THESE ROWS AND NOT THE REST. A tree is a form with a trunk and a crown
// that stands over a rider's head: `TREE_FORMS`. The rest of the roster —
// the bushes (a willow's dome, a juniper's column, the maquis, the moss mat),
// the tufts, the reeds and the stones — is drawn in code as it was: a mound
// of foliage out of the ground is one builder for a heather mat and a myrtle
// alike, and there are thousands more of them than of the trees.
//
// WHY SIX OF EACH. A shore drawn with one tree copied reads as one tree
// copied, however it is turned and tinted — the eye finds the repeat in a
// second. The code builds ONE shape a species and leans on the placer's
// height, yaw and tint for the rest; a model can afford the spread a kind
// actually takes on a coast: the stand tree and the one on the open slab,
// the flagged one on the windward point, the leaning one, the twin, the
// young. Variant 0 of every kind is the code's own tree, row for row.
//
// THE NUMBERS ARE THE CODE'S. `TREE_SHAPE` is every proportion the code's
// builder draws a tree form with — a pine's three plates, a spire's four
// tiers, a broadleaf's lumps, a palm's fronds, a mangrove's arches — lifted
// out of `flora-shapes.ts`, which reads them from here, so the model and the
// code cannot disagree about what a Scots pine is. A variant row is a
// DEPARTURE from its species' own look (`flora-defs.ts`), never a restatement
// of it: its spread is a share of the row's, its bare trunk and its stems are
// the row's unless it says otherwise.
//
// Which variant stands where is a hash of the trunk's place (`variantAt`), a
// different one from the placer's yaw and tint, so a variant is never tied
// to a heading.

import { FLORA, type FloraForm, type FloraSpec } from "./flora-defs.ts";

/** The forms that are trees — modelled, and drawn off the models. */
export const TREE_FORMS = ["pine", "spire", "broadleaf", "palm", "mangrove"] as const;
export type TreeForm = (typeof TREE_FORMS)[number];

export function isTreeForm(form: FloraForm): form is TreeForm {
  return (TREE_FORMS as readonly string[]).includes(form);
}

/** Every row of the roster that is a tree, in roster order — a KIND each,
 * one modelled glTF each (`pwa/models/trees/<kind>.glb`). */
export const TREE_KINDS: readonly string[] = FLORA.filter((s) => isTreeForm(s.look.form)).map(
  (s) => s.id,
);

/** A kind's row of the roster. */
export function treeSpec(kind: string): FloraSpec {
  const spec = FLORA.find((s) => s.id === kind);
  if (!spec || !isTreeForm(spec.look.form)) throw new Error(`no tree kind "${kind}"`);
  return spec;
}

/** How many variants every kind has. */
export const VARIANTS = 6;

/** THE TREE A MODEL IS MADE AT, m tall: the Blender builder states every
 * variant in metres at this height (its plan in the same metres), and
 * `tree-models.ts` divides it back out into the unit frame the code's
 * builder draws in — a metre tall, its foot on the ground — which the placer
 * scales by each plant's own height. */
export const TREE_REFERENCE = 10;

/**
 * EVERY PROPORTION THE CODE'S BUILDER DRAWS A TREE FORM WITH, in the unit
 * frame (shares of the height; a plan distance is a share of the height times
 * the row's `spread`). `flora-shapes.ts` builds from these and the Blender
 * builder models from them; the wobble the code adds to one plant of a
 * species (`wob`) is the code's own and stays there.
 */
export const TREE_SHAPE = {
  pine: {
    /** The bare trunk to `bare`, then the copper reach to the leader. */
    stem: [0.018, 0.012],
    upper: [0.012, 0.005],
    leader: 0.96,
    /** A broad, flat, high crown of plates, stacked from `low` of the way
     * between the bare trunk and `ceiling` over `span` of it. */
    plates: 3,
    ceiling: 0.98,
    low: 0.3,
    span: 0.56,
    /** The lowest plate's radius, and how much narrower the top one is. */
    radius: 0.56,
    narrow: 0.34,
    /** How far a plate may sit off the trunk, and its thickness and depth
     * against its radius. */
    drift: 0.28,
    squash: 0.5,
    depth: 0.92,
  },
  spire: {
    /** The trunk, to `trunk` of the height. */
    trunk: 0.28,
    stem: [0.018, 0.011],
    /** Tiers of boughs stacked from the bare trunk to `ceiling`, the lowest
     * `radius` wide, each narrower by `narrow` of that up the stack, and
     * `rise` tall, less `shorten` and `squat` up it. */
    tiers: 4,
    ceiling: 0.86,
    radius: 0.5,
    narrow: 0.72,
    rise: 0.34,
    shorten: 0.06,
    squat: 0.3,
  },
  broadleaf: {
    /** The stems, thinned by the stem count to the `thin` power, and leaned
     * `splay` of the spread apart out of one stool. */
    stem: [0.026, 0.015],
    thin: 0.3,
    splay: 0.2,
    /** The crown: a CORE lump and `lumps − 1` round it, `reach` (and up to
     * `reachVary` more) of the spread off the trunk, `lump` (and up to
     * `lumpVary` more) of it across; the core's height is `coreRise` of the
     * crown's half-height, the others' `lumpRise`, all squashed by the stem
     * count to the `stack` power. */
    lumps: 4,
    core: 0.34,
    coreRise: 0.94,
    reach: 0.2,
    reachVary: 0.14,
    lump: 0.24,
    lumpVary: 0.1,
    lumpRise: 0.6,
    stack: 0.16,
  },
  palm: {
    /** The trunk's lean off plumb (of the spread, either way), the knee its
     * two stems meet at (a share of the bare trunk) and its radii. */
    lean: 0.4,
    knee: 0.55,
    stem: [0.026, 0.02, 0.016],
    /** The bud the fronds come out of. */
    bud: 0.05,
    /** A frond's reach (a share of the spread, times 0.8 and up to 0.4 more),
     * its droop (a share of its reach) and its half-width. */
    reach: 0.55,
    reachVary: [0.8, 0.4],
    droop: [0.35, 0.45],
    width: 0.06,
  },
  mangrove: {
    /** The prop roots come down to a ring `ring` of the spread out (times
     * `spread[0]` and up to `spread[1]` more), knee at `knee[0]` (and up to
     * `knee[1]` more) of the bare trunk, `inset` in to the trunk. */
    ring: 0.45,
    spread: [0.7, 0.5],
    knee: [0.45, 0.2],
    inset: [0.6, 0.15],
    root: [0.011, 0.01, 0.012],
    /** The short trunk into the canopy: from `from` of the bare trunk to
     * `over` above it. */
    trunk: { from: 0.85, over: 0.18, r: [0.03, 0.02] },
    /** THE DOME over everything above the bare trunk, `dome` of the spread
     * across, and its two shoulders. */
    dome: 0.48,
    shoulders: 2,
    shoulder: 0.32,
    shoulderAt: 0.22,
    shoulderRise: 0.68,
  },
} as const;

/** A spire's boughs (the spruce, the cypress): the tiers of drooping limbs
 * over a dark core that the code draws as stacked cones. */
export type SpireShape = {
  readonly form: "spire";
  /** How many whorls of boughs, how many boughs a whorl. */
  readonly tiers: number;
  readonly sides: number;
  /** How the crown narrows up the tree: 1 the code's cones, over 1 a spire. */
  readonly taper: number;
  /** How far a bough droops at its tip, 1 the builder's own. */
  readonly droop: number;
  /** The boughs pushed to the lee, 0 round … 1 all on one side — a tree on
   * a windward point. */
  readonly flag: number;
  /** Whorls left out, by index from the bottom. */
  readonly missing: readonly number[];
  /** A second leader off the top. */
  readonly twin: boolean;
  /** A dead spike over the top whorl, as a share of the height. */
  readonly spire: number;
  /** How ragged the boughs are, 0 even … 1 a column of tufts. */
  readonly rough: number;
};

/** A pine: a bare trunk (or several) under pads of needles. */
export type PineShape = {
  readonly form: "pine";
  /** How many pads, and how far off the trunk they reach (a share of the
   * crown's radius). */
  readonly pads: number;
  readonly reach: number;
  /** A pad's thickness, a share of the height. */
  readonly thick: number;
  /** A kink in the trunk at this share of the height, sideways by `kinkBy`
   * of the crown's radius (0: straight). */
  readonly kink: number;
  readonly kinkBy: number;
  /** 0 old and flat-topped … 1 a young cone of whorls. */
  readonly young: number;
  /** Two stems off one root, splayed by this much, rad (0: one stem). */
  readonly splay: number;
  /** The pads set in this many flat LAYERS round the stem; 0 scattered. */
  readonly layers: number;
};

/** A broadleaf IN LEAF: limbs off the stem, forking into clusters of leaves
 * over a dark core. */
export type BroadleafShape = {
  readonly form: "broadleaf";
  /** Limbs off the stems, and leaf clusters on them. */
  readonly limbs: number;
  readonly clusters: number;
  /** The crown's outline: −1 an upright teardrop … 0 the code's lumps … 1 a
   * broad dome. */
  readonly dome: number;
  /** How far the outer clusters hang: 0 reaching up … 1 weeping. */
  readonly weep: number;
  /** How far multiple stems lean apart, rad. */
  readonly splay: number;
  /** How much of the crown is air between the clusters, 0 dense … 1 open. */
  readonly open: number;
  /** How gnarled the stems are: 0 straight … 1 an old olive's twist. */
  readonly twist: number;
};

/** A palm: a ringed trunk under a crown of fronds. */
export type PalmShape = {
  readonly form: "palm";
  /** A FAN palm's fronds are palmate — a pleated fan on a stalk — where a
   * feather palm's are a rachis with leaflets down both sides. */
  readonly fan: boolean;
  /** How far the trunk bows off its lean, a share of the height. */
  readonly curve: number;
  /** How far the fronds droop, 1 the builder's own. */
  readonly droop: number;
  /** Dead fronds hanging in a skirt under the crown. */
  readonly skirt: number;
  /** A cluster of nuts under the crown. */
  readonly nuts: boolean;
};

/** A mangrove: a dome of leaf clusters stood up on arching prop roots. */
export type MangroveShape = {
  readonly form: "mangrove";
  /** How high the roots arch, 1 the code's knee. */
  readonly arch: number;
  /** How far the dome spreads past the roots, 1 the code's. */
  readonly dome: number;
  /** Aerial roots hanging from the canopy's underside. */
  readonly drops: number;
};

export type TreeShape = SpireShape | PineShape | BroadleafShape | PalmShape | MangroveShape;

export type TreeVariant = {
  readonly kind: string;
  readonly index: number;
  /** What the sheet calls it. */
  readonly name: string;
  /** The whole tree leaned off plumb, rad, toward +x. */
  readonly lean: number;
  /** Its plan spread, a share of the row's (`Look.spread`). */
  readonly spread: number;
  /** How much of the height stands bare under the crown, and how many stems
   * (or fronds, or roots) — the row's own unless the variant says. */
  readonly bare: number;
  readonly stems: number;
  /** Where the top is, a share of the height (a broken top is under 1). */
  readonly top: number;
  readonly shape: TreeShape;
};

type Departure = {
  readonly name: string;
  readonly lean?: number;
  readonly spread?: number;
  readonly bare?: number;
  readonly stems?: number;
  readonly top?: number;
};

const sp = (o: Partial<SpireShape> = {}): SpireShape => ({
  form: "spire",
  tiers: 9,
  sides: 9,
  taper: 1,
  droop: 1,
  flag: 0,
  missing: [],
  twin: false,
  spire: 0,
  rough: 0,
  ...o,
});

const pn = (o: Partial<PineShape> = {}): PineShape => ({
  form: "pine",
  pads: 6,
  reach: 0.8,
  thick: 0.1,
  kink: 0,
  kinkBy: 0,
  young: 0,
  splay: 0,
  layers: 0,
  ...o,
});

const bl = (o: Partial<BroadleafShape> = {}): BroadleafShape => ({
  form: "broadleaf",
  limbs: 8,
  clusters: 22,
  dome: 0,
  weep: 0.2,
  splay: 0.2,
  open: 0.3,
  twist: 0,
  ...o,
});

const pm = (o: Partial<PalmShape> = {}): PalmShape => ({
  form: "palm",
  fan: false,
  curve: 0.1,
  droop: 1,
  skirt: 0,
  nuts: false,
  ...o,
});

const mg = (o: Partial<MangroveShape> = {}): MangroveShape => ({
  form: "mangrove",
  arch: 1,
  dome: 1,
  drops: 0,
  ...o,
});

/** Every kind's six: a departure from the row and the form's own knobs. The
 * rows of kinds the sibling snowmobile game models too (the spruce, the
 * pine, the birch, the aspen, the rowan, the alder) start from its rows,
 * with the snow left off and the leaves put back. */
const ROWS: Readonly<Record<string, readonly (readonly [Departure, TreeShape])[]>> = {
  alder: [
    [{ name: "grey alder" }, bl({ limbs: 7, clusters: 24, dome: -0.3, splay: 0.25 })],
    [{ name: "alder clump", stems: 4, spread: 1.1 }, bl({ clusters: 26, splay: 0.32, dome: -0.2 })],
    [{ name: "tall alder", stems: 2, bare: 0.26 }, bl({ clusters: 22, dome: -0.5, splay: 0.12 })],
    [{ name: "streamside", lean: 0.1 }, bl({ clusters: 24, splay: 0.3, weep: 0.35 })],
    [{ name: "dome alder", spread: 1.1 }, bl({ clusters: 26, dome: 0.4 })],
    [{ name: "young alder", stems: 2, spread: 0.8 }, bl({ limbs: 6, clusters: 16, dome: -0.4 })],
  ],
  birch: [
    [{ name: "downy birch" }, bl({ limbs: 9, clusters: 24, weep: 0.35, open: 0.4 })],
    [{ name: "weeping birch" }, bl({ limbs: 9, clusters: 26, weep: 0.85, open: 0.45 })],
    [{ name: "twin-stemmed", stems: 2 }, bl({ clusters: 26, splay: 0.14, weep: 0.4 })],
    [{ name: "shore birch", stems: 3, bare: 0.24 }, bl({ clusters: 26, splay: 0.28, weep: 0.4 })],
    [{ name: "slender birch", spread: 0.7, bare: 0.44 }, bl({ limbs: 7, clusters: 18, weep: 0.3 })],
    [{ name: "leaning birch", lean: 0.09 }, bl({ limbs: 8, clusters: 22, weep: 0.45, open: 0.4 })],
  ],
  aspen: [
    [{ name: "aspen" }, bl({ limbs: 8, clusters: 20, dome: -0.5, weep: 0.05, open: 0.35 })],
    [{ name: "tall aspen", spread: 0.85, bare: 0.5 }, bl({ clusters: 18, dome: -0.6, weep: 0 })],
    [{ name: "clone pair", stems: 2 }, bl({ clusters: 22, dome: -0.5, splay: 0.08, weep: 0.05 })],
    [{ name: "broad aspen", spread: 1.2 }, bl({ clusters: 24, dome: 0.3, weep: 0.1 })],
    [{ name: "young aspen", spread: 0.75, bare: 0.3 }, bl({ limbs: 6, clusters: 14, dome: -0.4 })],
    [{ name: "leaning aspen", lean: 0.07 }, bl({ clusters: 20, dome: -0.4, weep: 0.05 })],
  ],
  rowan: [
    [{ name: "rowan" }, bl({ clusters: 22, dome: 0.3, splay: 0.15 })],
    [{ name: "single rowan", stems: 1 }, bl({ clusters: 20, dome: 0.2 })],
    [{ name: "clump rowan", stems: 3, spread: 1.1 }, bl({ clusters: 24, splay: 0.3, dome: 0.4 })],
    [{ name: "spreading rowan", spread: 1.25 }, bl({ clusters: 24, dome: 0.8, weep: 0.3 })],
    [{ name: "tall rowan", stems: 1, bare: 0.34, spread: 0.85 }, bl({ clusters: 18, dome: 0 })],
    [{ name: "leaning rowan", lean: 0.08 }, bl({ clusters: 20, dome: 0.3 })],
  ],
  pine: [
    [{ name: "old pine" }, pn({ pads: 6 })],
    [{ name: "umbrella", bare: 0.68 }, pn({ pads: 5, reach: 0.95, thick: 0.07 })],
    [{ name: "tall stand pine", bare: 0.68, spread: 0.75 }, pn({ pads: 4, reach: 0.6 })],
    [{ name: "half-grown", bare: 0.42 }, pn({ pads: 7, reach: 0.75, young: 0.5 })],
    [{ name: "kinked" }, pn({ pads: 5, kink: 0.45, kinkBy: 0.35 })],
    [{ name: "windswept", lean: 0.08, top: 0.97 }, pn({ pads: 4, reach: 1, thick: 0.06 })],
  ],
  spruce: [
    [{ name: "dense spire" }, sp({ tiers: 9 })],
    [{ name: "pencil", spread: 0.7 }, sp({ tiers: 12, sides: 8, taper: 1.35 })],
    [{ name: "stand tree", bare: 0.3, spread: 0.85 }, sp({ tiers: 7, taper: 1.15 })],
    [{ name: "flagged", lean: 0.02 }, sp({ tiers: 9, flag: 0.7 })],
    [{ name: "gap-toothed" }, sp({ tiers: 10, missing: [2, 5, 6] })],
    [{ name: "twin-topped", bare: 0.12 }, sp({ tiers: 8, twin: true })],
  ],
  redmangrove: [
    [{ name: "red mangrove" }, mg()],
    [{ name: "tall mangrove", bare: 0.36 }, mg({ arch: 1.2, drops: 3 })],
    [{ name: "low thicket", spread: 1.25, bare: 0.24 }, mg({ arch: 0.8, dome: 1.2 })],
    [{ name: "leaning mangrove", lean: 0.1 }, mg({ drops: 2 })],
    [{ name: "young mangrove", spread: 0.8, stems: 6 }, mg({ arch: 0.9 })],
    [{ name: "stilted", stems: 11, bare: 0.4 }, mg({ arch: 1.3, drops: 4 })],
  ],
  blackmangrove: [
    [{ name: "black mangrove" }, bl({ clusters: 24, dome: 0.3, splay: 0.3 })],
    [
      { name: "mangrove clump", stems: 3, spread: 1.1 },
      bl({ clusters: 26, dome: 0.5, splay: 0.4 }),
    ],
    [{ name: "tall black mangrove", bare: 0.3 }, bl({ clusters: 22, dome: 0, splay: 0.2 })],
    [{ name: "low and wide", spread: 1.25, bare: 0.14 }, bl({ clusters: 26, dome: 0.8 })],
    [{ name: "leaning", lean: 0.08 }, bl({ clusters: 22, dome: 0.3, splay: 0.3 })],
    [{ name: "young", spread: 0.8 }, bl({ limbs: 6, clusters: 16, dome: 0.2 })],
  ],
  coconut: [
    [{ name: "beach palm", lean: 0.12 }, pm({ curve: 0.3, nuts: true })],
    [{ name: "tall straight", lean: 0.03 }, pm({ curve: 0.05, nuts: true })],
    [{ name: "bowed", lean: 0.2 }, pm({ curve: 0.55 })],
    [{ name: "heavy crown", stems: 12 }, pm({ curve: 0.2, nuts: true, droop: 1.2 })],
    [{ name: "young palm", bare: 0.6, spread: 1.2 }, pm({ curve: 0.12, droop: 0.8 })],
    [{ name: "windswept", lean: 0.15 }, pm({ curve: 0.35, skirt: 2, droop: 1.3 })],
  ],
  sabal: [
    [{ name: "cabbage palm" }, pm({ fan: true, curve: 0.05 })],
    [{ name: "tall cabbage palm", spread: 0.85, lean: 0.03 }, pm({ fan: true, curve: 0.08 })],
    [{ name: "skirted", stems: 13 }, pm({ fan: true, curve: 0.04, skirt: 5 })],
    [{ name: "young, booted", bare: 0.6, spread: 1.2 }, pm({ fan: true, curve: 0, skirt: 3 })],
    [{ name: "leaning", lean: 0.1 }, pm({ fan: true, curve: 0.2 })],
    [{ name: "round head", stems: 14, spread: 1.1 }, pm({ fan: true, curve: 0.05, droop: 0.8 })],
  ],
  liveoak: [
    [{ name: "live oak" }, bl({ limbs: 9, clusters: 26, dome: 0.8, splay: 0.2 })],
    [
      { name: "spreading giant", spread: 1.25 },
      bl({ limbs: 10, clusters: 28, dome: 1, twist: 0.4 }),
    ],
    [{ name: "twin", stems: 2 }, bl({ limbs: 9, clusters: 26, dome: 0.8, splay: 0.45 })],
    [{ name: "leaning", lean: 0.08 }, bl({ limbs: 8, clusters: 24, dome: 0.7, twist: 0.3 })],
    [{ name: "tall", spread: 0.85, bare: 0.36 }, bl({ clusters: 22, dome: 0.4 })],
    [{ name: "young", spread: 0.8 }, bl({ limbs: 6, clusters: 16, dome: 0.5 })],
  ],
  slashpine: [
    [{ name: "flatwoods pine" }, pn({ pads: 5, reach: 0.5, thick: 0.08 })],
    [{ name: "dense crown" }, pn({ pads: 7, reach: 0.5, young: 0.3 })],
    [{ name: "thin pole", bare: 0.74, spread: 0.8 }, pn({ pads: 4, reach: 0.45 })],
    [{ name: "young slash pine", bare: 0.36 }, pn({ pads: 8, reach: 0.55, young: 1 })],
    [{ name: "leaning pole", lean: 0.06 }, pn({ pads: 5, reach: 0.5 })],
    [{ name: "crooked", bare: 0.62 }, pn({ pads: 5, reach: 0.55, kink: 0.42, kinkBy: 0.25 })],
  ],
  holmoak: [
    [{ name: "holm oak" }, bl({ clusters: 26, dome: 0.4, open: 0.15 })],
    [{ name: "round crown", spread: 1.1 }, bl({ clusters: 28, dome: 0.7, open: 0.1 })],
    [{ name: "twin", stems: 2 }, bl({ clusters: 26, dome: 0.4, splay: 0.3, open: 0.15 })],
    [{ name: "tall holm oak", spread: 0.85, bare: 0.34 }, bl({ clusters: 22, dome: 0, open: 0.2 })],
    [{ name: "leaning", lean: 0.08 }, bl({ clusters: 24, dome: 0.4, twist: 0.3 })],
    [{ name: "young", spread: 0.8 }, bl({ limbs: 6, clusters: 16, dome: 0.3 })],
  ],
  olive: [
    [{ name: "grove olive" }, bl({ clusters: 22, dome: 0.5, splay: 0.35, twist: 0.8, open: 0.4 })],
    [{ name: "triple stool", stems: 3 }, bl({ clusters: 24, dome: 0.5, splay: 0.4, twist: 0.9 })],
    [{ name: "old gnarled", spread: 1.15 }, bl({ clusters: 24, dome: 0.6, twist: 1, open: 0.5 })],
    [{ name: "pruned vase", bare: 0.36 }, bl({ clusters: 20, dome: 0.8, splay: 0.5, open: 0.55 })],
    [{ name: "leaning", lean: 0.1 }, bl({ clusters: 20, dome: 0.4, twist: 0.7, open: 0.4 })],
    [{ name: "young olive", stems: 1, spread: 0.8 }, bl({ limbs: 6, clusters: 14, dome: 0.3 })],
  ],
  cypress: [
    [{ name: "column" }, sp({ tiers: 13, sides: 7, taper: 0.55, droop: 0.2, rough: 0.35 })],
    [
      { name: "flame", spread: 1.35 },
      sp({ tiers: 12, sides: 7, taper: 0.9, droop: 0.2, rough: 0.4 }),
    ],
    [
      { name: "twin spire", spread: 1.2 },
      sp({ tiers: 12, sides: 7, taper: 0.6, twin: true, rough: 0.35, droop: 0.2 }),
    ],
    [
      { name: "slim", spread: 0.8 },
      sp({ tiers: 15, sides: 6, taper: 0.45, droop: 0.15, rough: 0.3 }),
    ],
    [
      { name: "leaning column", lean: 0.07 },
      sp({ tiers: 13, sides: 7, taper: 0.55, droop: 0.2, rough: 0.35 }),
    ],
    [
      { name: "wind-cut", top: 0.95 },
      sp({ tiers: 12, sides: 7, taper: 0.7, flag: 0.6, rough: 0.5, droop: 0.2 }),
    ],
  ],
  coastpine: [
    [{ name: "coastal pine", lean: 0.06 }, pn({ pads: 6, reach: 0.85, thick: 0.08 })],
    [
      { name: "leaning out", lean: 0.16 },
      pn({ pads: 5, reach: 0.9, thick: 0.07, kink: 0.5, kinkBy: 0.2 }),
    ],
    [{ name: "open crown", bare: 0.55 }, pn({ pads: 4, reach: 0.95, thick: 0.07 })],
    [{ name: "twin-crowned", lean: 0.04 }, pn({ pads: 7, reach: 0.85, splay: 0.2 })],
    [{ name: "young", bare: 0.3 }, pn({ pads: 7, reach: 0.7, young: 0.7 })],
    [{ name: "windswept", lean: 0.1, top: 0.95 }, pn({ pads: 4, reach: 1, thick: 0.05 })],
  ],
};

/** Every kind's six, the row's look filled in. */
export const TREE_VARIANTS: Readonly<Record<string, readonly TreeVariant[]>> = (() => {
  const out: Record<string, readonly TreeVariant[]> = {};
  for (const kind of TREE_KINDS) {
    const look = treeSpec(kind).look;
    const rows = ROWS[kind];
    if (!rows) throw new Error(`no variant rows for the tree kind "${kind}"`);
    out[kind] = rows.map(([d, shape], index): TreeVariant => ({
      kind,
      index,
      name: d.name,
      lean: d.lean ?? 0,
      spread: d.spread ?? 1,
      bare: d.bare ?? look.bare,
      stems: d.stems ?? look.stems,
      top: d.top ?? 1,
      shape,
    }));
  }
  return out;
})();

/** A hash of the trunk's place, 0..1 — not the placer's own, so a variant is
 * never tied to a yaw or a tint. */
export function variantAt(x: number, z: number): number {
  let h = (Math.round(x * 16) * 2654435761 + Math.round(z * 16) * 40503) | 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Which of `variants` (all of them unless fewer are drawn) stands at (x, z). */
export function variantIndex(x: number, z: number, variants = VARIANTS): number {
  const n = Math.max(1, Math.min(VARIANTS, Math.round(variants)));
  return Math.min(n - 1, Math.floor(variantAt(x, z) * n));
}

/**
 * THE SILHOUETTE: how far the crown reaches from the trunk at a share `f` of
 * the height, as a share of the height — what the code's builder draws for
 * this variant's own bare trunk, spread and top, off `TREE_SHAPE`, with the
 * offsets its wobble adds left out. The Blender builder sizes a variant's
 * boughs, pads and clusters to it, so a model has the code's outline.
 */
export function crownAt(v: TreeVariant, f: number): number {
  const spec = treeSpec(v.kind);
  const s = spec.look.spread * v.spread;
  const top = v.top;
  if (f > top) return 0;
  switch (v.shape.form) {
    case "pine": {
      const P = TREE_SHAPE.pine;
      const shape = v.shape;
      let r = 0;
      for (let i = 0; i < P.plates; i++) {
        const t = i / (P.plates - 1);
        const y = (v.bare + (P.ceiling - v.bare) * (P.low + t * P.span)) * top;
        const rr = s * P.radius * (1 - t * P.narrow);
        const k = (f - y) / (rr * P.squash);
        if (Math.abs(k) < 1) r = Math.max(r, rr * Math.sqrt(1 - k * k));
      }
      if (shape.young > 0 && f >= v.bare) {
        const u = (f - v.bare) / Math.max(1e-6, top - v.bare);
        const cone = s * P.radius * (1 - u * 0.95);
        r = r * (1 - shape.young) + cone * shape.young;
      }
      return r;
    }
    case "spire": {
      const P = TREE_SHAPE.spire;
      let r = 0;
      for (let i = 0; i < P.tiers; i++) {
        const t = i / (P.tiers - 1);
        const y0 = (v.bare + (P.ceiling - v.bare) * t) * top;
        const h = (P.rise - t * P.shorten) * (1 - t * P.squat) * top;
        if (f < y0 || f > y0 + h) continue;
        r = Math.max(r, s * P.radius * (1 - t * P.narrow) * (1 - (f - y0) / h));
      }
      const u = (f - v.bare) / Math.max(1e-6, top - v.bare);
      return u <= 0 ? 0 : r * Math.pow(Math.max(0, 1 - u), Math.max(0, v.shape.taper - 1));
    }
    case "broadleaf": {
      const P = TREE_SHAPE.broadleaf;
      const mid = (v.bare + top) / 2;
      const rise = (top - v.bare) / 2;
      const k = (f - mid) / rise;
      if (Math.abs(k) >= 1) return 0;
      // The lumps stand off the trunk by the spread and are as wide as it,
      // thinned by the stem count, as the code's builder draws them.
      const thin = Math.pow(v.stems, P.thin);
      const width = s * (P.reach + P.reachVary / 2) + (s * (P.lump + P.lumpVary / 2)) / thin;
      return width * Math.pow(1 - k * k, 0.5 * (1 - 0.5 * v.shape.dome));
    }
    case "palm": {
      const P = TREE_SHAPE.palm;
      const reach = s * P.reach * (P.reachVary[0] + P.reachVary[1] / 2);
      const drop = reach * (P.droop[0] + P.droop[1] / 2);
      const crown = v.bare * top;
      if (f < crown - drop || f > crown + P.bud * 2) return 0;
      return reach * (1 - Math.abs(f - crown) / Math.max(drop, 1e-6)) + P.bud;
    }
    case "mangrove": {
      const P = TREE_SHAPE.mangrove;
      if (f < v.bare) return s * P.ring * P.spread[0] * (1 - f / Math.max(v.bare, 1e-6)) * 0.5;
      const mid = (v.bare + top) / 2;
      const rise = (top - v.bare) / 2;
      const k = (f - mid) / rise;
      return Math.abs(k) >= 1 ? 0 : s * P.dome * v.shape.dome * Math.sqrt(1 - k * k);
    }
  }
}
