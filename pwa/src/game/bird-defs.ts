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
// WHY THESE FOURTEEN, over two coasts. Each row says which coasts it lives
// on (`biomes`), the planner lays only the flocks of the coast it is on,
// and two birds live on both.
//
// THE TAIGA COAST. The gull, the tern, the cormorant and the eider are the
// shore's own — what is standing on every skerry and rafting in the lee of
// it from the ice going out to the ice coming back. The sea eagle is the
// taiga coast's raptor, one to a stretch of shore, and it perches at the
// top of the tallest pine rather than on any rock. The goose, the swan and
// the crane are the birds that CROSS: in vees and lines at height in
// spring and autumn, which is the one thing in this sky that says which
// way the year is going, and — the goose and the swan — down on the
// sheltered water through the summer between.
//
// THE MANGROVE COAST. The pelican is the coast: a line of them beating low
// over the water and one folding up and going in like a dropped sack. The
// osprey is its raptor, one to a stretch, over the flats on a crooked
// wing. The egret and the ibis and the spoonbill are the wading birds of
// the mangrove edge — white, white, and PINK — that get up off the mud in
// lines when the craft comes past; the frigatebird hangs at height on the
// longest wing for its weight in the sky and never seems to move. The gull
// and the cormorant are here too, because they are everywhere. Nothing
// crosses: a warm coast is where the skeins were going.
//
// The look (the paint, the wingtips, the bill) belongs to `bird-shapes.ts`.

import type { BiomeId, Season } from "@engine";

/** Every bird in the roster. */
export type BirdId =
  | "gull"
  | "tern"
  | "cormorant"
  | "eider"
  | "gannet"
  | "fulmar"
  | "kittiwake"
  | "eagle"
  | "goose"
  | "swan"
  | "crane"
  | "pelican"
  | "osprey"
  | "egret"
  | "ibis"
  | "spoonbill"
  | "booby"
  | "noddy"
  | "sootytern"
  | "frigatebird";

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
   * skeins over a northern shore most are geese, some are cranes, and a
   * line of white birds is the one you tell somebody about. */
  readonly share: number;
};

export type BirdSpec = {
  readonly id: BirdId;
  /** The name a sheet or a plan shows. */
  readonly name: string;
  /** WHICH COASTS IT LIVES ON OR CROSSES — ids from `engine/mapgen/biomes.ts`.
   * The planner lays only the rows of the coast it is on. */
  readonly biomes: readonly BiomeId[];
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
  /** A BIRD OF THE OPEN WATER rather than of the shore, and the one thing
   * that lets a roster reach past the buoys. Four of the five homes are
   * coastal by construction — a rock, a tree, a beach, a raft in
   * somebody's lee — so a roster without this block leaves the sky over
   * the outer half of every level as empty as the water under it.
   *
   * `offshore` is the band its raft and its beat stand in, m from the
   * water's edge, and `reach` is how far off the RACING LINE it may live.
   * The two are different questions and a pelagic bird needs both moved: a
   * shore flock is held near the line because a raft up a back bay is a
   * raft nobody meets, but a gannet is only ever met by riding OUT, and a
   * gannet held near the line is a gannet in the wrong place. Its raft is
   * asked for no lee either — nothing out there shelters anything. */
  readonly sea?: { readonly offshore: Band; readonly reach: number };
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
    biomes: ["taiga", "mangrove"],
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
    biomes: ["taiga"],
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
    biomes: ["taiga", "mangrove"],
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
    biomes: ["taiga"],
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
    id: "gannet",
    name: "Northern gannet",
    biomes: ["taiga"],
    // The biggest seabird on a northern coast, and unmistakable: white,
    // black-tipped, and shaped like a thrown dart at both ends.
    span: 1.75,
    length: 0.94,
    neck: 0.44,
    wing: { chord: 0.11, taper: 0.28, sweep: 0.3, wrist: 0.4 },
    beatHz: 2.6,
    stroke: 0.7,
    glide: 0.6,
    dihedral: 0.03,
    speed: 15,
    flock: { min: 3, max: 10 },
    formation: "line",
    // High enough for the plunge to be a plunge: a gannet goes in from
    // thirty metres and hits the water at a hundred kilometres an hour.
    altitude: { min: 20, max: 55 },
    beat: { min: 60, max: 160 },
    home: "water",
    roost: 9,
    cycle: { min: 90, max: 180 },
    airShare: 0.8,
    // The one thing everybody knows about a gannet.
    dive: 22,
    dries: false,
    perKm: 0.9,
    // Out where the water has depth under it, and a long way off the line
    // — a gannet is the reward for riding out rather than along.
    sea: { offshore: { min: 140, max: 800 }, reach: 900 },
    seasons: ["spring", "summer", "autumn"],
    passes: [],
  },
  {
    id: "fulmar",
    name: "Northern fulmar",
    biomes: ["taiga"],
    // STIFF WINGS AND NO BEAT: a fulmar shears along the troughs on
    // wings it barely moves, which is the one flight in the roster that
    // reads as the SEA rather than as a bird.
    span: 1.12,
    length: 0.47,
    neck: 0.34,
    wing: { chord: 0.14, taper: 0.42, sweep: 0.18, wrist: 0.46 },
    beatHz: 3.4,
    stroke: 0.5,
    glide: 0.9,
    dihedral: 0.0,
    speed: 13,
    flock: { min: 2, max: 7 },
    formation: "loose",
    // Low: it uses the lift off the face of a wave and never leaves it.
    altitude: { min: 2, max: 12 },
    beat: { min: 70, max: 180 },
    home: "water",
    roost: 8,
    cycle: { min: 120, max: 260 },
    airShare: 0.85,
    dive: 0,
    dries: false,
    perKm: 1.0,
    sea: { offshore: { min: 120, max: 800 }, reach: 900 },
    seasons: ["spring", "summer", "autumn", "winter"],
    passes: [],
  },
  {
    id: "kittiwake",
    name: "Black-legged kittiwake",
    biomes: ["taiga"],
    // The gull that is actually a bird of the open sea: smaller and
    // cleaner than the herring gull, and it comes in flocks over bait.
    span: 1.05,
    length: 0.39,
    neck: 0.36,
    wing: { chord: 0.14, taper: 0.34, sweep: 0.26, wrist: 0.42 },
    beatHz: 3.6,
    stroke: 0.85,
    glide: 0.4,
    dihedral: 0.04,
    speed: 12,
    flock: { min: 6, max: 20 },
    formation: "loose",
    altitude: { min: 8, max: 30 },
    beat: { min: 40, max: 120 },
    home: "water",
    roost: 10,
    cycle: { min: 80, max: 160 },
    airShare: 0.7,
    dive: 0,
    dries: false,
    perKm: 1.2,
    sea: { offshore: { min: 110, max: 800 }, reach: 900 },
    seasons: ["spring", "summer", "autumn", "winter"],
    passes: [],
  },
  {
    id: "eagle",
    name: "White-tailed eagle",
    biomes: ["taiga"],
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
    biomes: ["taiga"],
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
    biomes: ["taiga"],
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
    biomes: ["taiga"],
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
  // ── The mangrove coast ────────────────────────────────────────────────
  {
    id: "pelican",
    name: "Brown pelican",
    biomes: ["mangrove"],
    span: 2.1,
    length: 1.2,
    // The bill is a third of the bird: the head reaches far out front.
    neck: 0.44,
    // A broad, deep wing, the primaries splayed at the tip.
    wing: { chord: 0.19, taper: 0.5, sweep: 0.14, wrist: 0.5 },
    beatHz: 2.0,
    stroke: 0.6,
    // A few slow beats and a long glide a wing's height off the water.
    glide: 0.6,
    dihedral: 0.03,
    speed: 12,
    flock: { min: 3, max: 9 },
    formation: "line",
    altitude: { min: 3, max: 12 },
    beat: { min: 60, max: 150 },
    // Sits on the sea between fishing runs, a raft of big brown birds.
    home: "water",
    roost: 8,
    cycle: { min: 120, max: 260 },
    airShare: 0.45,
    // THE PLUNGE: from ten metres up, wings folding back on the way down,
    // and a splash the size of a hull's. The coast's signature moment.
    dive: 22,
    dries: false,
    // The everyday bird of the warm coast, as the gull is of the cold one.
    perKm: 1.4,
    seasons: ["spring", "summer", "autumn", "winter"],
    passes: [],
  },
  {
    id: "osprey",
    name: "Osprey",
    biomes: ["mangrove"],
    span: 1.6,
    length: 0.58,
    neck: 0.36,
    // THE CROOKED WING: a long hand angled back at a prominent wrist, so
    // the bird reads as a shallow M from below — the field mark.
    wing: { chord: 0.19, taper: 0.55, sweep: 0.2, wrist: 0.48 },
    beatHz: 2.4,
    stroke: 0.65,
    glide: 0.55,
    dihedral: 0.02,
    speed: 12,
    flock: { min: 1, max: 1 },
    formation: "loose",
    // Over the flats, looking down: the height a fish can be seen from.
    altitude: { min: 25, max: 70 },
    beat: { min: 50, max: 120 },
    home: "tree",
    roost: 0,
    cycle: { min: 150, max: 300 },
    airShare: 0.55,
    // Feet first, from the hover — every half minute or so on a good flat.
    dive: 40,
    dries: false,
    // One to a stretch of coast, like the eagle it replaces.
    perKm: 0.5,
    seasons: ["spring", "summer", "autumn", "winter"],
    passes: [],
  },
  {
    id: "egret",
    name: "Great egret",
    biomes: ["mangrove"],
    span: 1.5,
    length: 1.0,
    // A heron flies with its neck FOLDED, so the head sits back on the
    // shoulders and the legs trail: the reach out front is short for so
    // long a bird.
    neck: 0.3,
    // Broad, deep and rounded.
    wing: { chord: 0.22, taper: 0.6, sweep: 0.08, wrist: 0.5 },
    beatHz: 2.2,
    stroke: 0.6,
    glide: 0.15,
    dihedral: 0.02,
    speed: 10,
    flock: { min: 1, max: 3 },
    formation: "loose",
    altitude: { min: 4, max: 15 },
    beat: { min: 40, max: 100 },
    // Stands on the mangrove edge and the mud, and gets up when the craft
    // comes past.
    home: "shore",
    roost: 5,
    cycle: { min: 200, max: 400 },
    airShare: 0.2,
    dive: 0,
    dries: false,
    perKm: 1.0,
    seasons: ["spring", "summer", "autumn", "winter"],
    passes: [],
  },
  {
    id: "ibis",
    name: "White ibis",
    biomes: ["mangrove"],
    span: 0.95,
    length: 0.6,
    // Neck OUT in flight, unlike the heron's, with the curved bill ahead
    // of it.
    neck: 0.4,
    wing: { chord: 0.19, taper: 0.5, sweep: 0.1, wrist: 0.5 },
    beatHz: 3.4,
    stroke: 0.7,
    glide: 0.2,
    dihedral: 0.02,
    speed: 13,
    flock: { min: 5, max: 14 },
    // A line of white birds low along the shore — the mangrove edge's own
    // cormorant line, in white with black tips.
    formation: "line",
    altitude: { min: 8, max: 30 },
    beat: { min: 60, max: 150 },
    home: "shore",
    roost: 8,
    cycle: { min: 150, max: 320 },
    airShare: 0.35,
    dive: 0,
    dries: false,
    perKm: 0.9,
    seasons: ["spring", "summer", "autumn", "winter"],
    passes: [],
  },
  {
    id: "spoonbill",
    name: "Roseate spoonbill",
    biomes: ["mangrove"],
    span: 1.3,
    length: 0.8,
    neck: 0.42,
    wing: { chord: 0.2, taper: 0.55, sweep: 0.1, wrist: 0.5 },
    beatHz: 2.6,
    stroke: 0.65,
    glide: 0.2,
    dihedral: 0.03,
    speed: 12,
    flock: { min: 3, max: 9 },
    formation: "line",
    altitude: { min: 6, max: 25 },
    beat: { min: 60, max: 140 },
    home: "shore",
    roost: 7,
    cycle: { min: 200, max: 400 },
    airShare: 0.25,
    dive: 0,
    dries: false,
    // A flock on a flat, and not every flat: the one PINK thing in the
    // game, and the sighting a rider tells somebody about.
    perKm: 0.35,
    seasons: ["spring", "summer", "autumn", "winter"],
    passes: [],
  },
  {
    id: "booby",
    name: "Brown booby",
    biomes: ["mangrove"],
    // The warm coast's gannet, and it does the same thing: a fold and a
    // plunge, off a wing chocolate above and white below.
    span: 1.45,
    length: 0.75,
    neck: 0.42,
    wing: { chord: 0.12, taper: 0.28, sweep: 0.32, wrist: 0.42 },
    beatHz: 2.8,
    stroke: 0.75,
    glide: 0.55,
    dihedral: 0.03,
    speed: 13,
    flock: { min: 2, max: 8 },
    formation: "line",
    altitude: { min: 12, max: 40 },
    beat: { min: 60, max: 150 },
    home: "water",
    roost: 8,
    cycle: { min: 90, max: 190 },
    airShare: 0.8,
    dive: 26,
    dries: false,
    perKm: 0.85,
    sea: { offshore: { min: 130, max: 800 }, reach: 900 },
    seasons: ["spring", "summer", "autumn", "winter"],
    passes: [],
  },
  {
    id: "noddy",
    name: "Brown noddy",
    biomes: ["mangrove"],
    // A dark tern of the open ocean that works over whatever the fish
    // below have pushed up — so a raft of them out on the shelf is a sign
    // there is something under it, which on this coast there now is.
    span: 0.83,
    length: 0.4,
    neck: 0.35,
    wing: { chord: 0.12, taper: 0.28, sweep: 0.3, wrist: 0.38 },
    beatHz: 3.8,
    stroke: 0.9,
    glide: 0.25,
    dihedral: 0.03,
    speed: 10,
    flock: { min: 5, max: 16 },
    formation: "loose",
    altitude: { min: 4, max: 18 },
    beat: { min: 35, max: 110 },
    home: "water",
    roost: 9,
    cycle: { min: 70, max: 150 },
    airShare: 0.75,
    dive: 18,
    dries: false,
    perKm: 1.1,
    sea: { offshore: { min: 110, max: 800 }, reach: 900 },
    seasons: ["spring", "summer", "autumn", "winter"],
    passes: [],
  },
  {
    id: "sootytern",
    name: "Sooty tern",
    biomes: ["mangrove"],
    // Black above and white below, and it stays at sea for years at a
    // time: the most PELAGIC thing in either roster, and the flock that
    // says a rider has gone properly offshore.
    span: 0.9,
    length: 0.44,
    neck: 0.36,
    wing: { chord: 0.1, taper: 0.24, sweep: 0.34, wrist: 0.36 },
    beatHz: 3.6,
    stroke: 0.95,
    glide: 0.45,
    dihedral: 0.03,
    speed: 12,
    flock: { min: 8, max: 22 },
    formation: "loose",
    altitude: { min: 10, max: 35 },
    beat: { min: 50, max: 140 },
    home: "water",
    roost: 12,
    cycle: { min: 90, max: 200 },
    airShare: 0.85,
    dive: 0,
    dries: false,
    perKm: 1.0,
    // The furthest out of any row in the game: nothing brings a sooty
    // tern inshore.
    sea: { offshore: { min: 220, max: 800 }, reach: 900 },
    seasons: ["spring", "summer", "autumn", "winter"],
    passes: [],
  },
  {
    id: "frigatebird",
    name: "Magnificent frigatebird",
    biomes: ["mangrove"],
    span: 2.3,
    length: 1.0,
    neck: 0.35,
    // THE LONGEST WING FOR ITS WEIGHT IN THE SKY: narrow, pointed, and
    // deeply angled back at the wrist — a W hung under the sun.
    wing: { chord: 0.13, taper: 0.2, sweep: 0.4, wrist: 0.45 },
    beatHz: 1.4,
    stroke: 0.5,
    // Hardly ever beats: it hangs.
    glide: 0.92,
    dihedral: 0.02,
    speed: 11,
    flock: { min: 1, max: 3 },
    formation: "loose",
    altitude: { min: 80, max: 200 },
    beat: { min: 100, max: 220 },
    home: "tree",
    roost: 3,
    cycle: { min: 300, max: 600 },
    airShare: 0.85,
    dive: 0,
    dries: false,
    perKm: 0.25,
    seasons: ["spring", "summer", "autumn", "winter"],
    passes: [],
  },
];

/** The rows a coast flies, in roster order. */
export function birdsOf(biome: BiomeId): readonly BirdSpec[] {
  return BIRDS.filter((b) => b.biomes.includes(biome));
}

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
