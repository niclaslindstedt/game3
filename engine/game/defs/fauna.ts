// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FAUNA: what lives in the water the course runs through, as data.
//
// A row here is one ANIMAL, and everything about it that is not a colour:
// how long it is, how fast it swims, how deep it holds, how many travel
// together, how often it has to breathe, the water it is met in — and how
// OFTEN it is met, which is the number the whole catalog is really about.
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
// WHY THESE TEN on a Baltic taiga coast. The five fish and the harbour
// porpoise are the Bothnian Sea's own — the porpoise is a genuinely
// endangered animal there, and its rarity in the table is not a game
// balance decision. The white-beaked dolphin, the porbeagle, the killer
// whale and the minke are North Sea and Atlantic animals that stray into
// the Baltic a handful of times a century; they are in the catalog because
// the game wants them, and they are as rare as the catalog can make them
// while still being reachable. That is the honest reading of "the rarity
// they deserve".

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
  | "dolphin"
  | "shark"
  | "orca"
  | "minke";

/** What SHAPE an animal is, which is the only thing the physics of its
 * swimming needs to know: a fish and a shark beat their tails SIDEWAYS, a
 * cetacean beats its flukes UP AND DOWN, and a cetacean has to breathe. */
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
    name: "Baltic herring",
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
    // The Baltic's own cetacean, and down to a few hundred animals in the
    // whole sea. One in three or four rides is already generous to it.
    perKm: 0.16,
    breath: 12,
    temperature: { min: 4, max: 18 },
  },
  {
    id: "dolphin",
    name: "White-beaked dolphin",
    kind: "cetacean",
    length: 2.7,
    beam: 0.22,
    school: { min: 3, max: 8 },
    spread: 2.0,
    speed: 3.4,
    depth: { min: 1.5, max: 4.5 },
    water: 6,
    offshore: { min: 30, max: 240 },
    perKm: 0.075,
    breath: 16,
    temperature: { min: 4, max: 16 },
  },
  {
    id: "shark",
    name: "Porbeagle",
    kind: "shark",
    length: 2.3,
    beam: 0.2,
    school: { min: 1, max: 2 },
    spread: 1.5,
    speed: 1.9,
    depth: { min: 2, max: 5.5 },
    water: 7,
    offshore: { min: 40, max: 250 },
    perKm: 0.04,
    breath: 0,
    temperature: { min: 4, max: 17 },
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
    temperature: { min: 4, max: 15 },
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
