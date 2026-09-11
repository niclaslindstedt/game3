// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SEA BIRDS, AS DATA — one row per bird that lives on or crosses this
// coast: what it is, how it flies, where it sits, how many travel together
// and how often a stretch of shore carries a flock of them. The mirror of
// the fauna's split (`engine/game/defs/fauna.ts` says what an animal IS)
// and of the flora's (`flora-defs.ts` says what a plant is): this says what
// a bird is, `bird-plan.ts` places every flock and says where each bird is
// at a moment, `bird-shapes.ts` builds it and `birds.ts` draws it.
//
// Renderer-side, like the cover and for the same reason: nothing here is a
// solid. The hull rides under a wheeling flock and through a raft that
// lifts off the water ahead of it, and nothing in the engine has heard of
// either. Every flock is laid deterministically off the level's seed on the
// renderer's OWN generator and posed off the engine's OWN clock, so a seed
// flies the same birds every time without costing the run a single draw.
//
// WHY THESE EIGHT on a Bothnian coast. The gull, the tern, the cormorant
// and the eider are the shore's own — what is standing on every skerry and
// rafting in the lee of it from the ice going out to the ice coming back.
// The sea eagle is the taiga coast's raptor, one to a stretch of shore, and
// it perches at the top of the tallest pine rather than on any rock. The
// goose, the swan and the crane are the birds that CROSS: in vees and lines
// at height in spring and autumn, which is the one thing in this sky that
// says which way the year is going, and — the goose and the swan — down on
// the sheltered water through the summer between.
//
// The look (the paint, the wingtips, the bill) belongs to `bird-shapes.ts`.

import type { Season } from "@engine";

/** Every bird in the roster. */
export type BirdId = "gull" | "tern" | "cormorant" | "eider" | "eagle" | "goose" | "swan" | "crane";

export type Band = { readonly min: number; readonly max: number };

/** Where a flock lives between flights. `water` is a RAFT — the birds sit
 * on the sea and ride the swell; `skerry` is any rock standing out of the
 * water (a skerry, a stack, the mark — and a buoy, which a gull takes for
 * one); `tree` is the crown of one of the shore's tall trees; `shore` is
 * the ground a few metres up from the waterline. */
export type Home = "water" | "skerry" | "tree" | "shore";

/** How a flock stands in the air. `loose` is a crowd — a wheel of gulls;
 * `line` is a single trailing echelon, what cormorants and eiders fly low
 * over the water; `vee` is the migrating skein. */
export type Formation = "loose" | "line" | "vee";

/** How a bird crosses the sky when it is CROSSING rather than living here:
 * the height band it holds, how many make one passage and the shapes they
 * take, and how fast a passage goes over. A row without one never crosses;
 * a row with one and no `home` is only ever passing through. */
export type Passage = {
  readonly height: Band;
  readonly birds: Band;
  readonly shapes: readonly Formation[];
  /** Its weight among the birds crossing that season: of every hundred
   * skeins over a Bothnian shore most are geese, some are cranes, and a
   * line of white birds is the one you tell somebody about. */
  readonly share: number;
};

export type BirdSpec = {
  readonly id: BirdId;
  /** The name a sheet or a plan shows. */
  readonly name: string;
  /** Wingtip to wingtip, m, and bill to tail, m — the real ones. */
  readonly span: number;
  readonly length: number;
  /** How far ahead of the SHOULDERS the bill reaches and how far behind
   * them the tail ends, as shares of the length. Their ratio is most of a
   * silhouette: a swan's neck is as long as its back, a gull's a third. */
  readonly neck: number;
  /** The wing: its chord at the root as a share of the span, how much of
   * that is left at the tip, how far back the tip is swept as a share of
   * the half-span, and where the WRIST is along the half-span — the hinge
   * the hand folds on. A gull's hand is most of its wing and a goose's is
   * less than half. */
  readonly wing: {
    readonly chord: number;
    readonly taper: number;
    readonly sweep: number;
    readonly wrist: number;
  };
  /** The beat: strokes a second, and how far a stroke swings the wing off
   * level, rad. Heavy birds beat slow and shallow, a tern fast and deep. */
  readonly beatHz: number;
  readonly stroke: number;
  /** How much of a flight is spent on HELD wings, 0..1. A cormorant flaps
   * the whole way; a sea eagle hardly ever. */
  readonly glide: number;
  /** The dihedral held in a glide, rad — an eagle soars on a shallow V and
   * rocks on it, a gull holds its wings nearly flat. */
  readonly dihedral: number;
  /** Cruising airspeed, m/s. */
  readonly speed: number;
  /** How many travel in one flock. */
  readonly flock: Band;
  readonly formation: Formation;
  /** How high a flight holds over the water, m. */
  readonly altitude: Band;
  /** The loop a flight wheels round: its long semi-axis, m. */
  readonly beat: Band;
  /** Where the flock lives, and how far round that point it spreads, m —
   * a raft of eider is a broad thing, an eagle is one bird on one branch.
   * Absent for a bird that only ever crosses. */
  readonly home?: Home;
  readonly roost: number;
  /** ONE CYCLE of rest and flight, s, and how much of it is flight at the
   * height of the day. A gull is up half the time; an eider is a thing on
   * the water that occasionally isn't. */
  readonly cycle: Band;
  readonly airShare: number;
  /** Seconds between one PLUNGE and the next, per bird, for a bird that
   * fishes from the air — the tern's dive, wings folded at the bottom of
   * it. 0 for everything else. */
  readonly dive: number;
  /** Holds its wings out to DRY when it sits: the cormorant, which has no
   * waterproofing and stands on its rock like a heraldic device. */
  readonly dries: boolean;
  /** FLOCKS PER KILOMETRE of course — how common the bird is on the shore
   * it lives on. 0 for a bird that only passes over. */
  readonly perKm: number;
  /** The seasons it is on the coast at all, LIVING here. */
  readonly seasons: readonly Season[];
  /** …and the seasons it CROSSES, with how. */
  readonly passage?: Passage;
  readonly passes: readonly Season[];
};

export const BIRDS: readonly BirdSpec[] = [
  {
    id: "gull",
    name: "Herring gull",
    span: 1.45,
    length: 0.6,
    neck: 0.38,
    wing: { chord: 0.16, taper: 0.4, sweep: 0.22, wrist: 0.42 },
    beatHz: 3.2,
    stroke: 0.8,
    glide: 0.45,
    dihedral: 0.05,
    speed: 11,
    flock: { min: 4, max: 14 },
    formation: "loose",
    altitude: { min: 12, max: 45 },
    beat: { min: 30, max: 90 },
    home: "skerry",
    roost: 6,
    cycle: { min: 70, max: 150 },
    airShare: 0.55,
    dive: 0,
    dries: false,
    // The everyday bird of the coast: several flocks a ride, and one is
    // usually in the air.
    perKm: 1.8,
    seasons: ["spring", "summer", "autumn", "winter"],
    passes: [],
  },
  {
    id: "tern",
    name: "Arctic tern",
    span: 0.8,
    length: 0.35,
    neck: 0.36,
    // Long, narrow, swept: a tern's wing is nearly all hand.
    wing: { chord: 0.11, taper: 0.25, sweep: 0.32, wrist: 0.34 },
    beatHz: 4.2,
    stroke: 1.0,
    glide: 0.15,
    dihedral: 0.04,
    speed: 9,
    flock: { min: 3, max: 9 },
    formation: "loose",
    // Low, over the shallows it fishes: the one bird whose whole life is
    // within a few metres of the surface.
    altitude: { min: 5, max: 16 },
    beat: { min: 25, max: 70 },
    home: "shore",
    roost: 5,
    cycle: { min: 60, max: 120 },
    airShare: 0.75,
    // Every dozen seconds or so, per bird: a hover, a fold, a plunge.
    dive: 14,
    dries: false,
    perKm: 1.1,
    // A summer bird — here from the ice going out to the end of August,
    // and on its way to the other end of the world by autumn.
    seasons: ["spring", "summer"],
    passes: [],
  },
  {
    id: "cormorant",
    name: "Great cormorant",
    span: 1.35,
    length: 0.85,
    // The long neck held straight out and the long tail behind: from below
    // a cormorant is a cross with a stick through it.
    neck: 0.44,
    wing: { chord: 0.15, taper: 0.45, sweep: 0.12, wrist: 0.5 },
    beatHz: 3.6,
    stroke: 0.7,
    // Flaps the whole way, hard, and low: a cormorant is the one bird here
    // that never soars.
    glide: 0.05,
    dihedral: 0.02,
    speed: 14,
    flock: { min: 3, max: 8 },
    formation: "line",
    altitude: { min: 2, max: 7 },
    beat: { min: 60, max: 140 },
    home: "skerry",
    roost: 4,
    cycle: { min: 120, max: 240 },
    airShare: 0.3,
    dive: 0,
    dries: true,
    perKm: 0.8,
    seasons: ["spring", "summer", "autumn"],
    passes: [],
  },
  {
    id: "eider",
    name: "Common eider",
    span: 0.98,
    length: 0.62,
    neck: 0.34,
    // Short, broad and fast: a duck's wing, beating without a pause.
    wing: { chord: 0.17, taper: 0.5, sweep: 0.1, wrist: 0.52 },
    beatHz: 5.5,
    stroke: 0.6,
    glide: 0,
    dihedral: 0,
    speed: 17,
    flock: { min: 6, max: 18 },
    formation: "line",
    altitude: { min: 1.5, max: 5 },
    beat: { min: 60, max: 150 },
    // A RAFT: the birds sit on the water in the lee of a skerry, and the
    // one thing they do in a run is get up off it when the craft comes.
    home: "water",
    roost: 9,
    cycle: { min: 150, max: 320 },
    airShare: 0.14,
    dive: 0,
    dries: false,
    perKm: 0.9,
    seasons: ["spring", "summer", "autumn", "winter"],
    passes: [],
  },
  {
    id: "eagle",
    name: "White-tailed eagle",
    span: 2.3,
    length: 0.85,
    neck: 0.36,
    // The plank: a broad wing, square at the tip, hardly tapered at all —
    // which is how a sea eagle is told from anything else at any range.
    wing: { chord: 0.26, taper: 0.8, sweep: 0.06, wrist: 0.55 },
    beatHz: 1.6,
    stroke: 0.55,
    glide: 0.85,
    dihedral: 0.16,
    speed: 12,
    flock: { min: 1, max: 1 },
    formation: "loose",
    altitude: { min: 60, max: 140 },
    beat: { min: 70, max: 160 },
    home: "tree",
    roost: 0,
    cycle: { min: 180, max: 320 },
    airShare: 0.6,
    dive: 0,
    dries: false,
    // One to a stretch of coast, and not every stretch.
    perKm: 0.32,
    seasons: ["spring", "summer", "autumn", "winter"],
    passes: [],
  },
  {
    id: "goose",
    name: "Greylag goose",
    span: 1.6,
    length: 0.85,
    neck: 0.375,
    wing: { chord: 0.17, taper: 0.4, sweep: 0.14, wrist: 0.48 },
    beatHz: 3.1,
    stroke: 0.85,
    glide: 0.1,
    dihedral: 0.06,
    speed: 19,
    flock: { min: 3, max: 8 },
    formation: "line",
    altitude: { min: 20, max: 60 },
    beat: { min: 80, max: 180 },
    home: "water",
    roost: 8,
    cycle: { min: 160, max: 300 },
    airShare: 0.22,
    dive: 0,
    dries: false,
    perKm: 0.36,
    // Breeds here, so the summer has family parties between the bays; the
    // spring and the autumn have the skeins going over.
    seasons: ["summer"],
    passage: {
      height: { min: 90, max: 150 },
      birds: { min: 7, max: 15 },
      shapes: ["vee", "line"],
      share: 5,
    },
    passes: ["spring", "autumn"],
  },
  {
    id: "swan",
    name: "Whooper swan",
    span: 2.4,
    length: 1.5,
    // The neck as long as the back: the whole silhouette.
    neck: 0.62,
    wing: { chord: 0.16, taper: 0.45, sweep: 0.12, wrist: 0.46 },
    beatHz: 2.1,
    stroke: 0.7,
    glide: 0.08,
    dihedral: 0.05,
    speed: 16,
    flock: { min: 2, max: 5 },
    formation: "line",
    altitude: { min: 15, max: 40 },
    beat: { min: 90, max: 200 },
    home: "water",
    roost: 10,
    cycle: { min: 200, max: 400 },
    airShare: 0.1,
    dive: 0,
    dries: false,
    // A pair on a sheltered bay, and not every bay.
    perKm: 0.18,
    seasons: ["summer"],
    passage: {
      height: { min: 80, max: 130 },
      birds: { min: 4, max: 9 },
      shapes: ["line"],
      share: 1,
    },
    passes: ["spring", "autumn"],
  },
  {
    id: "crane",
    name: "Common crane",
    span: 2.2,
    length: 1.15,
    // Neck out front and legs trailing behind: the longest thing in the sky.
    neck: 0.5,
    wing: { chord: 0.2, taper: 0.55, sweep: 0.08, wrist: 0.5 },
    beatHz: 1.9,
    stroke: 0.6,
    glide: 0.25,
    dihedral: 0.05,
    speed: 15,
    flock: { min: 5, max: 12 },
    formation: "vee",
    altitude: { min: 100, max: 180 },
    beat: { min: 100, max: 200 },
    roost: 0,
    cycle: { min: 200, max: 400 },
    airShare: 0,
    dive: 0,
    dries: false,
    // Never lives on the shore: cranes are a thing that goes over.
    perKm: 0,
    seasons: [],
    passage: {
      height: { min: 110, max: 190 },
      birds: { min: 6, max: 14 },
      shapes: ["vee"],
      share: 3,
    },
    passes: ["spring", "autumn"],
  },
];

export const BIRD_IDS: readonly BirdId[] = BIRDS.map((b) => b.id);

const BY_ID = new Map<BirdId, BirdSpec>(BIRDS.map((b) => [b.id, b]));

export function birdById(id: BirdId): BirdSpec {
  const spec = BY_ID.get(id);
  if (!spec) throw new Error(`no bird row for "${id}"`);
  return spec;
}

export function isBirdId(id: string): id is BirdId {
  return BY_ID.has(id as BirdId);
}
