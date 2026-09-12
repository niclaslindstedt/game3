// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FAUNA: what lives in the water the course runs through, as data.
//
// A row here is one ANIMAL, and everything about it that is not a colour:
// how long it is, how fast it swims, how deep it holds, how many travel
// together, how often it comes up and how far out of the water it comes
// when it does, the water it is met in — and how OFTEN it is met, which is
// the number the whole catalog is really about.
// The look (the paint, the patches, the fins) belongs to the renderer's own
// table in `pwa/src/game/fauna.ts`, the way a craft's dimensions are here
// and its paint is in `craft-styles.ts`.
//
// RARITY IS THE POINT. A shore where every animal turns up every ride has no
// animals on it, only scenery; the pleasure of a whale is that it is a whale
// and you have ridden thirty coasts without seeing one. So `perKm` — pods
// per kilometre of coast — spans three orders of magnitude, from schools of
// herring you cannot ride a level without crossing to a minke that a seed in
// forty or so carries. `rarityOf` turns that number into the word for it;
// the number is the truth and the word is only its label, which is why the
// word is derived rather than stated twice.
//
// A "pod" is one group placed on the level: a school of two dozen herring, a
// pair of porpoises, one pike lying alone. `perKm` counts PODS, not animals,
// and `school` says how many are in one.
//
// WHY THESE EIGHTEEN, over two coasts. The taiga's are a cold brackish
// sea's own — five fish and the small harbour porpoise, which is a
// genuinely endangered animal on such a coast, so its rarity in the table
// is not a game balance decision — and the two big northern strays, the
// killer whale and the minke, that wander in a handful of times a century;
// they are in the catalog because the game wants them, and they are as
// rare as the catalog can make them while still being reachable. The
// mangrove's are a warm coast's: the inshore fish along the mangrove edge
// and over the flats, the ray on the sand, the two air-breathers that are
// not whales at all — the turtle and the manatee — the dolphins that work
// the channels, the bull shark in the murk of the passes, and the great
// hammerhead that is that coast's once-in-fifty-seeds. Which coast offers
// which is `engine/mapgen/biomes.ts`'s `fauna`; the catalog only says
// what each animal is. That is the honest reading of "the rarity they
// deserve".

import type { Band } from "../../mapgen/rules.ts";

/** Every animal in the catalog. The ids are the campaign's forever: a
 * saved sighting names one. */
export type FaunaId =
  | "herring"
  | "roach"
  | "perch"
  | "pike"
  | "salmon"
  | "porpoise"
  | "orca"
  | "minke"
  | "mullet"
  | "snook"
  | "redfish"
  | "tarpon"
  | "stingray"
  | "turtle"
  | "manatee"
  | "dolphin"
  | "shark"
  | "hammerhead";

/** What SHAPE an animal is, which is the only thing the physics of its
 * swimming needs to know: a fish and a shark beat their tails SIDEWAYS, a
 * cetacean beats its flukes UP AND DOWN, and a cetacean has to breathe.
 * The turtle and the manatee are filed as cetaceans for exactly that pair
 * of reasons — a flat tail (or none) and a breath — and the tarpon is a
 * fish that breathes anyway, which `breath` says and the kind does not. */
export type FaunaKind = "fish" | "shark" | "cetacean";

/** How often an animal is met, as a word. Derived from `perKm` by
 * `rarityOf` — never stated in a row, so the two can never disagree. */
export type Rarity = "common" | "uncommon" | "scarce" | "rare" | "legendary";

export type FaunaSpec = {
  readonly id: FaunaId;
  /** The name a sighting shows. */
  readonly name: string;
  readonly kind: FaunaKind;
  /** Nose to tail, m. */
  readonly length: number;
  /** Widest beam as a share of the length — what makes a herring a sliver
   * from above and a minke a log. */
  readonly beam: number;
  /** How many travel in one pod. */
  readonly school: Band;
  /** How loosely the pod travels: the formation's radius in BODY LENGTHS
   * per root of the pod's size (`faunaPose`'s `reach`), so a school of
   * thirty is wider than a school of three without being ten times it. A
   * herring school packs into a couple of metres; a pod of orca strings out
   * over ten. Zero for an animal that travels alone. */
  readonly spread: number;
  /** Cruising speed, m/s. Real cruising speeds, not sprints: a herring
   * school moves at about a body length a second, a minke at 3 m/s. */
  readonly speed: number;
  /** How deep the pod's centreline holds, m below the surface. Far
   * shallower than `water` for every animal in the catalog, and
   * deliberately so: an animal needs depth UNDER it but spends its life in
   * the top few metres of the column — which is also the only part of it a
   * chase camera, looking along the sea rather than down into it, can see
   * into at all. The two numbers say different things and neither is the
   * other's slack. */
  readonly depth: Band;
  /** The least water a pod of these needs under it, m — checked all the way
   * round the beat it swims, so an animal never turns up inside the bed. */
  readonly water: number;
  /** The band it is found in, m from the shore. The fish come into the
   * shallows; the big animals stay out where the water has depth. */
  readonly offshore: Band;
  /** PODS PER KILOMETRE of coast — the rarity, and the one number a level's
   * roster is drawn from. */
  readonly perKm: number;
  /** Seconds between one breath and the next; 0 for a fish, which never
   * comes up. A cetacean rolls its back through the surface on this beat,
   * and that roll is how a rider sees one at all — a chase camera looks
   * ALONG the water rather than down into it, so an animal holding at
   * depth is a shadow and an animal at the surface is a sighting. These
   * are the short end of each species' real breathing interval for that
   * reason: a minke that sounded for twenty minutes would be a row in the
   * catalog nobody ever met. */
  readonly breath: number;
  /** Seconds between one BASKING RUN and the next, for an animal that does
   * not breathe air but comes up anyway — a porbeagle hunting or lying at
   * the surface with its dorsal and the tip of its tail out. 0 for anything
   * that stays down. At most one of `breath` and `bask` is ever set: they
   * are two reasons for the same rise, and the swim model treats them as
   * one. */
  readonly bask: number;
  /** HOW HIGH IT COMES at the top of a rise: the depth of its centreline
   * then, in BODY RADII (half a beam × the length) below the water over
   * it. About 1 for everything here, and that is the whole design — one
   * radius down puts the back AWASH and leaves the DORSAL, and only the
   * dorsal, standing clear of the sea. That is what a sighting at sea
   * actually is: a fin cutting the surface, not an animal riding on top of
   * it. Measured against the water over the pod rather than mean sea
   * level, because a level's sea is metres high and a fin that clears the
   * mathematical plane by a hand's breadth clears nothing at all. */
  readonly awash: number;
  /** Seconds between one BREACH and the next — the leap that takes the
   * whole animal out of the water and is the only time this game shows an
   * animal against the sky rather than against the sea. Only the MALES of a
   * species breach (`isMale` in `engine/game/fauna.ts`), so a pod throws one
   * about as often as this divided by the bulls in it. 0 for everything that
   * never leaves the water. */
  readonly breach: number;
  /** The water temperature band it is met in, °C — a level's water
   * (R13) either falls in it or the animal is not on that coast that day. */
  readonly temperature: Band;
};

/** `perKm` at or above which an animal earns each word, richest first. A
 * level is a couple of kilometres of coast, so "common" is several pods a
 * ride and "legendary" is one seed in dozens. */
const RARITY_FLOOR: readonly (readonly [Rarity, number])[] = [
  ["common", 1.5],
  ["uncommon", 0.35],
  ["scarce", 0.1],
  ["rare", 0.03],
  ["legendary", 0],
];

/** How often an animal is met, as a word. */
export function rarityOf(perKm: number): Rarity {
  for (const [word, floor] of RARITY_FLOOR) if (perKm >= floor) return word;
  return "legendary";
}

export const FAUNA: readonly FaunaSpec[] = [
  {
    id: "herring",
    name: "Herring",
    kind: "fish",
    length: 0.22,
    beam: 0.16,
    school: { min: 14, max: 30 },
    spread: 1.2,
    speed: 0.8,
    depth: { min: 0.8, max: 3 },
    water: 2.2,
    offshore: { min: 10, max: 180 },
    perKm: 3.4,
    breath: 0,
    bask: 0,
    awash: 0,
    breach: 0,
    temperature: { min: 4, max: 18 },
  },
  {
    id: "roach",
    name: "Roach",
    kind: "fish",
    length: 0.24,
    beam: 0.22,
    school: { min: 8, max: 20 },
    spread: 1.1,
    speed: 0.6,
    depth: { min: 0.6, max: 2 },
    water: 1.6,
    offshore: { min: 6, max: 90 },
    perKm: 2.2,
    breath: 0,
    bask: 0,
    awash: 0,
    breach: 0,
    temperature: { min: 8, max: 22 },
  },
  {
    id: "perch",
    name: "Perch",
    kind: "fish",
    length: 0.3,
    beam: 0.24,
    school: { min: 5, max: 12 },
    spread: 1.4,
    speed: 0.7,
    depth: { min: 0.7, max: 2.5 },
    water: 2,
    offshore: { min: 8, max: 120 },
    perKm: 1.7,
    breath: 0,
    bask: 0,
    awash: 0,
    breach: 0,
    temperature: { min: 6, max: 22 },
  },
  {
    id: "pike",
    name: "Pike",
    kind: "fish",
    // An ambush fish: one, lying over a weed bed in the shallows, moving
    // barely at all. The slowest thing in the catalog on purpose.
    length: 0.95,
    beam: 0.13,
    school: { min: 1, max: 1 },
    spread: 0,
    speed: 0.35,
    depth: { min: 0.6, max: 1.8 },
    water: 1.5,
    offshore: { min: 6, max: 70 },
    perKm: 0.55,
    breath: 0,
    bask: 0,
    awash: 0,
    breach: 0,
    temperature: { min: 8, max: 22 },
  },
  {
    id: "salmon",
    name: "Sea trout",
    kind: "fish",
    length: 0.8,
    beam: 0.17,
    school: { min: 2, max: 5 },
    spread: 2.6,
    speed: 1.6,
    depth: { min: 1, max: 3.5 },
    water: 3,
    offshore: { min: 15, max: 200 },
    perKm: 0.42,
    breath: 0,
    bask: 0,
    awash: 0,
    breach: 0,
    temperature: { min: 4, max: 16 },
  },
  {
    id: "porpoise",
    name: "Harbour porpoise",
    kind: "cetacean",
    length: 1.6,
    beam: 0.24,
    school: { min: 1, max: 3 },
    spread: 2.4,
    speed: 2.2,
    depth: { min: 1.2, max: 3.5 },
    water: 4.5,
    offshore: { min: 25, max: 220 },
    // The cold sea's own cetacean, and down to a few hundred animals in
    // the whole of it. One in three or four rides is already generous.
    perKm: 0.16,
    breath: 12,
    bask: 0,
    // A quick low roll: the blunt little triangular fin, and gone again.
    awash: 0.9,
    breach: 0,
    temperature: { min: 4, max: 18 },
  },
  {
    id: "orca",
    name: "Killer whale",
    kind: "cetacean",
    length: 6.8,
    beam: 0.24,
    school: { min: 2, max: 5 },
    spread: 1.0,
    speed: 3.2,
    depth: { min: 2, max: 5.5 },
    water: 9,
    offshore: { min: 45, max: 250 },
    perKm: 0.02,
    breath: 20,
    bask: 0,
    // A bull's fin stands nearly two metres over a back that never leaves
    // the water: the tallest thing in the catalog, and the whole point.
    awash: 0.9,
    breach: 0,
    temperature: { min: 4, max: 16 },
  },
  {
    id: "minke",
    name: "Minke whale",
    kind: "cetacean",
    length: 8.4,
    beam: 0.2,
    school: { min: 1, max: 2 },
    spread: 0.9,
    speed: 2.8,
    depth: { min: 2.5, max: 6 },
    water: 12,
    offshore: { min: 60, max: 250 },
    // The rarest thing on the coast: roughly one seed in forty carries one,
    // and it is the sighting the whole catalog exists to make possible.
    perKm: 0.011,
    breath: 30,
    bask: 0,
    // A long back rolling through, low — a rorqual surfaces flat.
    awash: 0.85,
    breach: 0,
    temperature: { min: 4, max: 15 },
  },
  // ── The mangrove coast ────────────────────────────────────────────────
  {
    id: "mullet",
    name: "Striped mullet",
    kind: "fish",
    length: 0.4,
    beam: 0.18,
    school: { min: 12, max: 30 },
    spread: 1.2,
    speed: 0.7,
    depth: { min: 0.5, max: 2 },
    water: 1.5,
    offshore: { min: 6, max: 120 },
    perKm: 3.2,
    breath: 0,
    bask: 0,
    awash: 0,
    // THE MULLET JUMPS. Nobody knows why, and every warm coast is full of
    // them doing it: a silver fish clearing the water and landing flat on
    // its side. The one fish in the catalog that leaves the water at all,
    // and with a school of twenty the surface off a beach is never still.
    breach: 28,
    temperature: { min: 15, max: 33 },
  },
  {
    id: "snook",
    name: "Snook",
    kind: "fish",
    length: 0.75,
    beam: 0.18,
    school: { min: 2, max: 5 },
    spread: 1.8,
    speed: 0.9,
    depth: { min: 0.6, max: 2 },
    water: 1.6,
    // The mangrove edge itself: a snook lies in the shade of the roots.
    offshore: { min: 5, max: 70 },
    perKm: 1.8,
    breath: 0,
    bask: 0,
    awash: 0,
    breach: 0,
    temperature: { min: 18, max: 33 },
  },
  {
    id: "redfish",
    name: "Red drum",
    kind: "fish",
    length: 0.8,
    beam: 0.22,
    school: { min: 3, max: 8 },
    spread: 1.6,
    speed: 0.8,
    depth: { min: 0.5, max: 1.8 },
    water: 1.4,
    offshore: { min: 5, max: 90 },
    perKm: 1.6,
    breath: 0,
    bask: 0,
    awash: 0,
    breach: 0,
    temperature: { min: 16, max: 32 },
  },
  {
    id: "tarpon",
    name: "Tarpon",
    kind: "fish",
    length: 1.8,
    beam: 0.16,
    school: { min: 2, max: 6 },
    spread: 2.2,
    speed: 1.4,
    depth: { min: 1, max: 3.5 },
    water: 3.5,
    offshore: { min: 20, max: 200 },
    perKm: 0.5,
    // A FISH THAT BREATHES AIR — a tarpon gulps it, and the roll it makes
    // doing so, the silver back and the tall dorsal turning over at the
    // surface, is how a rider ever sees a fish two metres long.
    breath: 30,
    bask: 0,
    awash: 0.9,
    breach: 0,
    temperature: { min: 22, max: 32 },
  },
  {
    id: "stingray",
    name: "Southern stingray",
    kind: "fish",
    // A disc: the beam is most of the length, which is what the body
    // builder needs to make a ray out of the same loft as a fish.
    length: 1.1,
    beam: 0.85,
    school: { min: 1, max: 3 },
    spread: 1.5,
    speed: 0.4,
    depth: { min: 0.4, max: 1.5 },
    water: 1.2,
    offshore: { min: 4, max: 60 },
    perKm: 0.9,
    breath: 0,
    bask: 0,
    awash: 0,
    breach: 0,
    temperature: { min: 18, max: 33 },
  },
  {
    id: "turtle",
    name: "Loggerhead turtle",
    // Filed with the cetaceans: it breathes, and it has no tail to beat.
    kind: "cetacean",
    length: 1.0,
    beam: 0.75,
    school: { min: 1, max: 1 },
    spread: 0,
    speed: 0.5,
    depth: { min: 0.8, max: 2.5 },
    water: 2.5,
    offshore: { min: 20, max: 200 },
    perKm: 0.13,
    // Up every few minutes when it is on the move; the short end of that.
    breath: 45,
    bask: 0,
    // The head and the top of the shell out — the whole sighting.
    awash: 1,
    breach: 0,
    temperature: { min: 20, max: 32 },
  },
  {
    id: "manatee",
    name: "Manatee",
    kind: "cetacean",
    length: 3.0,
    beam: 0.33,
    school: { min: 1, max: 3 },
    spread: 1.6,
    speed: 0.9,
    depth: { min: 0.8, max: 2.2 },
    water: 3,
    // Inshore, over the seagrass: the one big animal that is met in the
    // shallows rather than out past them, which is exactly why the boats
    // on its coast have a speed limit.
    offshore: { min: 8, max: 90 },
    perKm: 0.3,
    breath: 40,
    bask: 0,
    // A broad grey back breaking the surface, and the nostrils; no fin.
    awash: 1,
    breach: 0,
    temperature: { min: 20, max: 32 },
  },
  {
    id: "dolphin",
    name: "Bottlenose dolphin",
    kind: "cetacean",
    length: 2.8,
    beam: 0.22,
    school: { min: 3, max: 8 },
    spread: 2.0,
    speed: 3.2,
    depth: { min: 1.5, max: 4.5 },
    water: 6,
    offshore: { min: 30, max: 240 },
    // The one animal in the catalog whose rarity is set by what it DOES
    // rather than by how often it is there: the bull's breach is the
    // coast's signature moment, and a moment a rider meets on one seed in
    // fourteen is a moment nobody has seen. Uncommon — better than half
    // the coasts carry a pod, and it is still the rarest thing a rider can
    // count on.
    perKm: 0.45,
    breath: 16,
    bask: 0,
    // The fin on a rise; the whole animal only on the bull's breach.
    awash: 0.85,
    breach: 55,
    temperature: { min: 15, max: 32 },
  },
  {
    id: "shark",
    name: "Bull shark",
    kind: "shark",
    length: 2.5,
    beam: 0.24,
    school: { min: 1, max: 2 },
    spread: 1.5,
    speed: 1.6,
    depth: { min: 1.5, max: 4 },
    water: 5,
    offshore: { min: 30, max: 220 },
    perKm: 0.06,
    breath: 0,
    // A shark breathes water, but it cruises the passes with its fin out,
    // and the fin cutting along the surface is the entire sighting.
    bask: 40,
    // Back awash, fin and the tip of the tail out — the whole sighting.
    awash: 0.95,
    breach: 0,
    temperature: { min: 18, max: 32 },
  },
  {
    id: "hammerhead",
    name: "Great hammerhead",
    kind: "shark",
    length: 4.2,
    beam: 0.17,
    school: { min: 1, max: 1 },
    spread: 0,
    speed: 1.8,
    depth: { min: 2.5, max: 6 },
    water: 9,
    offshore: { min: 60, max: 250 },
    // The rarest thing on the warm coast: one seed in fifty, and the tall
    // sickle of a fin that is the sighting the whole roster exists for.
    perKm: 0.02,
    breath: 0,
    bask: 45,
    awash: 0.95,
    breach: 0,
    temperature: { min: 20, max: 32 },
  },
];

export const FAUNA_IDS: readonly FaunaId[] = FAUNA.map((f) => f.id);

const BY_ID = new Map<FaunaId, FaunaSpec>(FAUNA.map((f) => [f.id, f]));

export function faunaById(id: FaunaId): FaunaSpec {
  const spec = BY_ID.get(id);
  if (!spec) throw new Error(`no fauna row for "${id}"`);
  return spec;
}

export function isFaunaId(id: string): id is FaunaId {
  return BY_ID.has(id as FaunaId);
}
