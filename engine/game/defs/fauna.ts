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
// and its paint is in `craft-styles.ts`. This file states the TYPE, the
// rarity ladder and the cold coast's rows; the warm coast's are next door
// in `fauna-warm.ts`, the polar coast's in `fauna-arctic.ts` and the karst
// coast's in `fauna-karst.ts`, all folded in below, the way `defs/sea.ts`
// is folded into `TUNING` — one subject too big for one file under the
// §20.5 cap.
//
// THE CATALOG IS A GRADIENT, AND THE GRADIENT IS THE DESIGN. `offshore` is
// what makes riding out to sea worth doing: the small fish are banded into
// the first hundred metres or so, the middle of the roster works the water
// past them, and the big animals — the whales, the dolphin schools, the
// basking shark, the great rorqual — are banded to start where the shore's
// own fish have stopped. A level's water reaches some seven hundred metres
// offshore and is forty metres deep out there, so the outer half of every
// level is the half the catalog is really built for. Nothing was out there
// before this, and the sea past the buoys read as empty because it WAS.
//
// RARITY IS STILL THE POINT, and rarity is not emptiness. `perKm` — pods
// per kilometre of coast — spans two and a half orders of magnitude, from
// schools of herring you cannot ride a level without crossing to a
// humpback a handful of seeds in a hundred carry. What changed is the
// FLOOR: an animal nobody ever meets is a row in a table rather than a
// sighting, so the big ones are common enough that riding offshore is
// reliably rewarded and rare enough that which one you got still matters.
// `rarityOf` turns that number into the word for it; the number is the
// truth and the word is only its label, which is why the word is derived
// rather than stated twice.
//
// A "pod" is one group placed on the level: a school of two dozen herring, a
// pair of porpoises, one pike lying alone. `perKm` counts PODS, not animals,
// and `school` says how many are in one.
//
// WHY THESE FIFTY-SIX, over four coasts. The taiga's are a cold brackish sea's
// own — the shore's fish, the grey seal hauled off every skerry coast like
// it, and the small harbour porpoise — and then the water past them: the
// salmon running at sea, the cod, the white-beaked dolphin, the basking
// shark lying with its dorsal and the tip of its tail out, the killer
// whale, and the two great rorquals. The mangrove's are a warm shelf's,
// and `fauna-warm.ts` says why; the arctic's are the ice edge's, and
// `fauna-arctic.ts` says why. Which coast offers which is
// `engine/mapgen/biomes.ts`'s `fauna`; the catalog only says what each
// animal is.

import type { Band } from "../../mapgen/rules.ts";
import { ARCTIC_FAUNA } from "./fauna-arctic.ts";
import { KARST_FAUNA } from "./fauna-karst.ts";
import { WARM_FAUNA } from "./fauna-warm.ts";

/** Every animal in the catalog. The ids are the campaign's forever: a
 * saved sighting names one. */
export type FaunaId =
  | "herring"
  | "roach"
  | "perch"
  | "pike"
  | "seatrout"
  | "salmon"
  | "cod"
  | "seal"
  | "porpoise"
  | "whitebeak"
  | "basking"
  | "orca"
  | "minke"
  | "humpback"
  | "mullet"
  | "snook"
  | "redfish"
  | "stingray"
  | "barracuda"
  | "tarpon"
  | "manatee"
  | "turtle"
  | "greenturtle"
  | "dolphin"
  | "spotted"
  | "shark"
  | "tiger"
  | "hammerhead"
  | "manta"
  | "whaleshark"
  | "brydes"
  | "polarcod"
  | "capelin"
  | "char"
  | "ringed"
  | "bearded"
  | "polarbear"
  | "harp"
  | "walrus"
  | "beluga"
  | "narwhal"
  | "sleeper"
  | "bowhead"
  | "sardine"
  | "seabream"
  | "seabass"
  | "garfish"
  | "dentex"
  | "amberjack"
  | "striped"
  | "bluefin"
  | "sunfish"
  | "swordfish"
  | "blueshark"
  | "monkseal"
  | "finwhale";

/** What SHAPE an animal is, which is the only thing the physics of its
 * swimming needs to know: a fish and a shark beat their tails SIDEWAYS, a
 * cetacean beats its flukes UP AND DOWN, and a cetacean has to breathe.
 * The turtle, the manatee and the seal are filed as cetaceans for exactly
 * that pair of reasons — a flat tail (or none) and a breath — and the
 * tarpon is a fish that breathes anyway, which `breath` says and the kind
 * does not. A shark is the one kind that comes up WITHOUT a breath
 * (`bask`), so the sunfish and the swordfish, which lie at the surface
 * for no breath either, are filed as sharks. */
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
   * from above and a minke a log. Over 1 for a ray, which is a wing. */
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
   * round the beat it swims, so an animal never turns up inside the bed.
   * It is also the second half of the offshore gradient, and the honest
   * half: a level's bed falls away from six metres inshore to forty past
   * the four-hundred mark, so a row that needs twenty metres of water
   * cannot stand inshore however its band is written. */
  readonly water: number;
  /** THE BAND IT IS FOUND IN, m from the shore, and the number that decides
   * whether riding out to sea is worth anything. The shore's fish are
   * banded into the first hundred metres; the big animals START where those
   * stop, so the density of everything large rises the further out a rider
   * goes. A band reaching 800 reaches the seaward edge of any level. */
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
   * not breathe air but comes up anyway — a basking shark lying at the
   * surface with its dorsal and the tip of its tail out. 0 for anything
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
   * (R13) either falls in it or the animal is not on that coast that day.
   *
   * THE COLD END IS LOAD-BEARING and was the quiet reason a third of the
   * taiga's seeds were empty: every cold row was written with a floor of
   * 4 °C while the coast deals water down to 2, so the coldest seeds fell
   * through the whole catalog and carried a seal and nothing else. The
   * floors here are where the animals actually are — a cod spawns at
   * 0–5 °C, a grey seal hauls out on an ice-fringed skerry, and the
   * rorquals feed in water near freezing. What genuinely stops in a cold
   * sea is the brackish SHORE fish (the roach, the perch, the pike) and
   * the basking shark, which really is a summer visitor. */
  readonly temperature: Band;
};

/** `perKm` at or above which an animal earns each word, richest first. A
 * level is a couple of kilometres of coast, so "common" is several pods a
 * ride and "legendary" is a handful of seeds in a hundred.
 *
 * The rungs are set so the ladder reads off the catalog rather than the
 * other way round: the shore's fish are common, the sea's middle is
 * uncommon to scarce, the killer whale and the basking shark are scarce,
 * the minke and the two great sharks rare, and the legendary rows are the
 * four GREAT WHALES — the humpback, the warm coast's rorqual, the polar
 * coast's bowhead and the karst coast's fin whale — and the one animal
 * rarer than a whale, the karst's monk seal. A word nothing earns is a
 * word that means nothing. */
const RARITY_FLOOR: readonly (readonly [Rarity, number])[] = [
  ["common", 1.5],
  ["uncommon", 0.4],
  ["scarce", 0.15],
  ["rare", 0.09],
  ["legendary", 0],
];

/** How often an animal is met, as a word. */
export function rarityOf(perKm: number): Rarity {
  for (const [word, floor] of RARITY_FLOOR) if (perKm >= floor) return word;
  return "legendary";
}

/** THE COLD COAST — the taiga's own, shore first and open sea last. */
const COLD_FAUNA: readonly FaunaSpec[] = [
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
    // The one small fish that is met the whole way out: a herring shoal is
    // what everything further down this list has come in to eat, so an
    // empty offshore band here would leave the big animals with no reason
    // to be where they are.
    offshore: { min: 10, max: 480 },
    perKm: 3.6,
    breath: 0,
    bask: 0,
    awash: 0,
    breach: 0,
    temperature: { min: 1, max: 18 },
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
    // Brackish and inshore: a roach is a bay's fish and never a sea's.
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
    perKm: 1.8,
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
    perKm: 0.6,
    breath: 0,
    bask: 0,
    awash: 0,
    breach: 0,
    temperature: { min: 8, max: 22 },
  },
  {
    id: "seatrout",
    name: "Sea trout",
    kind: "fish",
    // The coastal half of the pair: a sea trout spends its sea years
    // within sight of the shore it was spawned on, which is what tells it
    // from the salmon below.
    length: 0.8,
    beam: 0.17,
    school: { min: 2, max: 5 },
    spread: 2.6,
    speed: 1.6,
    depth: { min: 1, max: 3.5 },
    water: 3,
    offshore: { min: 15, max: 160 },
    perKm: 0.95,
    breath: 0,
    bask: 0,
    awash: 0,
    breach: 0,
    temperature: { min: 1, max: 16 },
  },
  {
    id: "salmon",
    name: "Salmon",
    kind: "fish",
    // AND THE SEA-GOING HALF. A salmon at sea is an offshore fish in a
    // travelling shoal, running hard and high in the water, and it is the
    // first thing on this coast a rider meets by going OUT rather than by
    // going along.
    length: 0.95,
    beam: 0.18,
    school: { min: 4, max: 12 },
    spread: 2.8,
    speed: 2.1,
    depth: { min: 1, max: 4 },
    water: 6,
    offshore: { min: 130, max: 620 },
    perKm: 0.95,
    breath: 0,
    bask: 0,
    awash: 0,
    breach: 0,
    temperature: { min: 1, max: 16 },
  },
  {
    id: "cod",
    name: "Cod",
    kind: "fish",
    // The big fish of the open coast, and the one that says how far out
    // you are: cod hold over the deep ground and come up through the
    // column after the herring rather than lying on the bottom under it.
    length: 0.9,
    beam: 0.2,
    school: { min: 3, max: 9 },
    spread: 2.0,
    speed: 0.9,
    depth: { min: 2, max: 6 },
    water: 9,
    offshore: { min: 160, max: 700 },
    perKm: 0.85,
    breath: 0,
    bask: 0,
    awash: 0,
    breach: 0,
    temperature: { min: 0, max: 14 },
  },
  {
    id: "seal",
    name: "Grey seal",
    kind: "cetacean",
    // Filed with the cetaceans for the same reason the turtle is: it
    // breathes, and what it beats is not a fish's tail. A skerry coast is
    // a grey seal's coast — the commonest big animal on it by a long way,
    // and the one a rider meets inshore as well as out.
    length: 2.0,
    beam: 0.3,
    school: { min: 1, max: 4 },
    spread: 2.2,
    speed: 1.6,
    depth: { min: 1, max: 3.5 },
    water: 4,
    offshore: { min: 15, max: 320 },
    perKm: 0.75,
    breath: 22,
    bask: 0,
    // A head and a length of back, and no fin on it at all — which is
    // exactly what tells a seal from a porpoise at range.
    awash: 1,
    breach: 0,
    temperature: { min: 0, max: 17 },
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
    offshore: { min: 25, max: 420 },
    perKm: 0.42,
    breath: 12,
    bask: 0,
    // A quick low roll: the blunt little triangular fin, and gone again.
    awash: 0.9,
    breach: 0,
    temperature: { min: 1, max: 18 },
  },
  {
    id: "whitebeak",
    name: "White-beaked dolphin",
    kind: "cetacean",
    // THE NORTHERN DOLPHIN, and the cold coast's answer to the bottlenose:
    // a school out over the deep water, fast, noisy and bow-riding, with
    // the pale saddle that names it from above.
    length: 2.7,
    beam: 0.23,
    school: { min: 5, max: 14 },
    spread: 2.2,
    speed: 3.6,
    depth: { min: 1.5, max: 5 },
    water: 14,
    offshore: { min: 230, max: 800 },
    perKm: 0.4,
    breath: 15,
    bask: 0,
    awash: 0.85,
    breach: 40,
    temperature: { min: 1, max: 15 },
  },
  {
    id: "basking",
    name: "Basking shark",
    kind: "shark",
    // The second-biggest fish there is, and it spends its summer lying at
    // the surface with its mouth open — so the whole animal is on show,
    // moving at a walking pace, which no other shark in this catalog is.
    length: 7.5,
    beam: 0.16,
    school: { min: 1, max: 3 },
    spread: 1.6,
    speed: 1.0,
    depth: { min: 1.5, max: 4 },
    water: 15,
    offshore: { min: 240, max: 800 },
    perKm: 0.18,
    breath: 0,
    // It is up more than it is down: the dorsal, and the tail tip a body
    // length behind it, which is the sighting people misreport as a
    // sea serpent.
    bask: 22,
    awash: 0.9,
    breach: 0,
    temperature: { min: 6, max: 16 },
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
    water: 11,
    offshore: { min: 200, max: 800 },
    perKm: 0.22,
    breath: 20,
    bask: 0,
    // A bull's fin stands nearly two metres over a back that never leaves
    // the water: the tallest thing in the catalog, and the whole point.
    awash: 0.9,
    breach: 0,
    temperature: { min: 0, max: 16 },
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
    water: 18,
    offshore: { min: 300, max: 800 },
    perKm: 0.14,
    breath: 30,
    bask: 0,
    // A long back rolling through, low — a rorqual surfaces flat.
    awash: 0.85,
    breach: 0,
    temperature: { min: 1, max: 15 },
  },
  {
    id: "humpback",
    name: "Humpback whale",
    kind: "cetacean",
    // THE RAREST THING ON THE COAST AND THE BIGGEST, and the only one that
    // throws forty tonnes clear of the water: the sighting the whole
    // catalog exists to make possible, banded as far out as a level goes
    // and needing more water under it than anything else in the game.
    length: 13.0,
    beam: 0.22,
    school: { min: 1, max: 3 },
    spread: 1.2,
    speed: 2.4,
    depth: { min: 3, max: 7 },
    water: 22,
    offshore: { min: 360, max: 800 },
    perKm: 0.075,
    breath: 34,
    bask: 0,
    awash: 0.85,
    // Rarely, and worth every second of riding out to be there for it.
    breach: 85,
    temperature: { min: 1, max: 15 },
  },
];

export const FAUNA: readonly FaunaSpec[] = [
  ...COLD_FAUNA,
  ...WARM_FAUNA,
  ...ARCTIC_FAUNA,
  ...KARST_FAUNA,
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
