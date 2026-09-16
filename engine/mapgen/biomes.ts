// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIOMES: which COAST a level is built on, as data.
//
// A biome is everything about a shore that is not the course: what the
// land is made of and how it stands, what the water is (brackish or salt,
// warm or cold), how thickly the rocks stand offshore, how much of the
// waterline is beach, how big a sea its wind grows and how much ocean swell
// reaches it, what the sky over it can be (R19), and what swims in its
// water (R20). The difference between the coasts is stated here, once, as
// rows the rest of the generator reads through `biomeOf`. Nothing else in
// `mapgen/` names a biome: the geology asks the row how high the land
// stands and how much of a bay is sand, the placer asks it how many rocks
// a kilometre carries, the compiler asks it what the water is, the sea asks
// it how big to grow.
//
// A BIOME IS A KIND OF COAST AND NEVER A PLACE. The rows are written from
// real coasts — the numbers are measured ones, and the comments say what
// each is a fact about — but nothing here, or anywhere the rows are read,
// names a country, a sea or a shore that exists. The campaign, when it
// comes, will put the rider on the TAIGA COAST and the MANGROVE COAST, not
// on a map.
//
// Seven ids are reserved in `types.ts` so a campaign location never changes
// its name; TWO rows are built. The taiga's is the coast every rule in
// `rules.ts` was written against — a cold northern skerry coast: low,
// glacially planed bedrock slabs sliding into brackish water, boulder
// fields the ice left behind, gravel and sand collecting in the bays,
// skerries and reefs a stone's throw out, and the open sea broken up by
// the islands before it ever reaches the shore. The mangrove's is its
// opposite in nearly every row: a flat, warm, salt coast of white sand and
// mangrove, nothing standing higher than a dune, no rock to speak of, and
// a clear turquoise sea with a long lazy groundswell in it. Asking for an
// unbuilt biome throws, by design: a level on a coast nobody has drawn is
// not a level.

import type { FaunaId } from "../game/defs/fauna.ts";
import type { Season } from "../lib/solar.ts";
import type { Band } from "./rules.ts";
import type { BiomeId, Weather } from "./types.ts";

/** THE COAST'S RIVER (R26, R27): what this kind of coast does to the water
 * that runs out of it. Every number is a multiple of the rule book's own,
 * so the taiga's row — the coast the rules were written against — is all
 * ones, and no taiga seed re-rolls for the row existing. */
export type RiverShape = {
  /** The MOUTH: how wide the river's water is where it leaves the race, as
   * a multiple of the corridor's own half-width there. Over 1 the mouth
   * opens out wider than the channel the race runs through — an estuary —
   * and it is held under R1's ceiling whatever the row asks, because the
   * race is still laid through it. */
  readonly mouth: number;
  /** Multiplier on `river.head`, the half-width the creek ends at. */
  readonly head: number;
  /** Multiplier on `river.taper`, the power the width closes by. Under 1
   * the river holds its width further up the country — a lowland river
   * losing its tributaries slowly — and over 1 it closes at once past the
   * mouth, the way a rock channel does. */
  readonly taper: number;
  /** Multiplier on `river.radius` AND `river.swingScale`: the meander drawn
   * bigger or smaller as one shape. Over 1 the loops are wider and longer,
   * a flat coast's; under 1 a river bending tight between rock. The
   * SINUOSITY that comes out is what R26 holds it to, on every coast. */
  readonly bend: number;
  /** Multiplier on `river.discharge`'s band (R27): what comes out of the
   * mouth. A northern coast's rivers are torrents and a flat warm coast's
   * are lazy, and with the width above this is the whole of the current. */
  readonly discharge: number;
  /** THE BARS: low islands standing in the mouth's own reach — a delta.
   * `count` of them, each `r` metres across (mean plan radius, warped like
   * any island), `reach` metres up the river from the mouth in walked
   * length, keeping `channel` metres of water between their edge and the
   * river's centreline so the river still runs. Null on a coast whose
   * rivers leave through a single channel. */
  readonly bars: {
    readonly count: Band;
    readonly r: Band;
    readonly reach: Band;
    readonly channel: number;
  } | null;
};

export type Biome = {
  readonly id: BiomeId;
  /** The name a menu shows. */
  readonly name: string;
  /** The water: density kg/m³ and, per season, the temperature band °C a
   * level draws from (R13). */
  readonly water: { readonly density: number; readonly temperature: Record<Season, Band> };
  /** How far north the coast lies, degrees (R13) — the one number that
   * turns a level's hour into a place for the sun, and so into a sky. It
   * is a fact about the coast rather than about the run, which is why it
   * sits in the biome's row and not in the rule book. */
  readonly latitude: number;
  /** Multiplier on `LEVEL_RULES.land.plateau` — how high this coast's land
   * stands against the rule book's band (1 is the taiga's). Held under
   * `land.maxHeight` whatever it is. */
  readonly relief: number;
  /** HOW STEEPLY THE LAND COMES DOWN TO THE WATER: the share of
   * `LEVEL_RULES.land.reach` over which the shore climbs to its hill
   * (R2). 1 is the taiga's low rise over the whole reach; under it the same
   * hill is met sooner — a coast of steep banks and headlands falling
   * straight into the sea — and the ground is flat from there. Never over
   * 1: the offshore field stops measuring at `land.measured`, and R2's
   * check reads the profile against the full reach. With `relief` this is
   * the landscape: low and gentle, low and steep, high and gentle, high and
   * steep are four different coasts. */
  readonly climb: number;
  /** What this coast's RIVER is like (R26, R27). */
  readonly river: RiverShape;
  /** Multipliers on `LEVEL_RULES.solids.<kind>.perKm`. */
  readonly rocks: {
    readonly skerry: number;
    readonly boulder: number;
    readonly reef: number;
    readonly erratic: number;
    readonly stack: number;
  };
  /** Multiplier on `LEVEL_RULES.surface.boulder.threshold`'s complement:
   * above 1 the boulder fields are wider, below 1 sparser, at 0 there are
   * none. */
  readonly boulderField: number;
  /** Whether this coast's soft stretches carry a sand beach at all
   * (R16) — a coast of bare rock says no and every waterline on it is
   * stone. */
  readonly beaches: boolean;
  /** THE SHORE'S QUILT (R16, R21): how much of the waterline is beach.
   * `sand` is a multiple of `LEVEL_RULES.surface.sand.rugged`, the
   * ruggedness at or under which a stretch carries sand — 1 is the taiga's
   * rock coast with beaches in it, and a coast of beaches with rock in it
   * is above it. Never so high that one material takes the whole coast:
   * R21's run limit is the same on every biome, and a coast that fails it
   * is a coast the search rerolls until the generator gives up. */
  readonly shore: { readonly sand: number };
  /** HOW BIG THIS COAST'S SEA IS, as multiples of what the rule book's wind
   * grows (`TUNING.sea.heightScale` is the arcade dial under both). `wind`
   * scales the two wind bands — the sea this coast's own wind builds and
   * the chop on water that sea cannot reach — and `swell` scales the
   * groundswell dealt from past the horizon (R36's `dealSwell`). A
   * skerry coast has the islands between it and the ocean, so its swell is
   * mostly gone by the time it arrives and its wind sea is broken up; a
   * low open coast with a warm shallow shelf gets the whole swell, long
   * and lazy, and a wind sea that never stands very high over it. `wind` is
   * read by `createSea` and `swell` by the generator, where the height a
   * seed is dealt is drawn — never both in one place, because the wind sea
   * is grown at a run and the swell is part of what the level IS. */
  readonly sea: { readonly wind: number; readonly swell: number };
  /** The skies this coast can be under (R19), lightest first. A coast is
   * partly its weather — a northern shore gets the line squall and never
   * the summer haze, a warm shore the other way about — so the chart is
   * the biome's rather than the rule book's. */
  readonly weathers: readonly Weather[];
  /** What SWIMS on this coast (R20) — ids from `engine/game/defs/fauna.ts`.
   * How often each is met is the catalog's `perKm`, not the biome's: a
   * coast says which animals are possible, the animal says how rare it is.
   * A coast that offers none simply has no life in its water. */
  readonly fauna: readonly FaunaId[];
};

/** Every biome that is BUILT, in the order they are offered. */
export const BIOME_IDS: readonly BiomeId[] = ["taiga", "mangrove"];

export const BIOMES: Readonly<Partial<Record<BiomeId, Biome>>> = {
  taiga: {
    id: "taiga",
    name: "Taiga coast",
    // A brackish northern sea — 1005 kg/m³ — and cold: the monthly means
    // of the sea off a coast like this run from under a degree in February
    // and March, through 5 °C in May and 11 °C in June, to 16 °C in July
    // and August, back to 13 °C in September, 9 °C in October and 5 °C in
    // November, and the shallow bays run a few degrees either side of the
    // open sea. Each season's band is the months it is dated to (see
    // `DECLINATION`): May with the ice just out, high summer, the early
    // October cool-down, and November's last open water before the ice.
    water: {
      density: 1005,
      temperature: {
        spring: { min: 3, max: 8 },
        summer: { min: 10, max: 18 },
        autumn: { min: 7, max: 13 },
        winter: { min: 2, max: 6 },
      },
    },
    // Far enough north that the midsummer sun only just sets, which is the
    // whole character of the summer light here: long low evenings, a
    // twilight that never finishes, and a sunrise three hours after
    // midnight — and far enough north that the December sun barely clears
    // the water at noon.
    latitude: 62,
    relief: 1,
    climb: 1,
    // A skerry coast's river is a ROCK CHANNEL: it leaves through the one
    // gap the ice left in the granite, no wider than the race's own water,
    // closes fast to a creek between slabs, bends tight, and carries a
    // northern catchment's worth of water out — the torrent of the two
    // coasts. No delta: there is no sediment to build one from, and the
    // mouth is a sound, not a fan. The rule book's own numbers, which is
    // what the ones mean.
    river: { mouth: 1, head: 1, taper: 1, bend: 1, discharge: 1, bars: null },
    rocks: { skerry: 1, boulder: 1, reef: 1, erratic: 1, stack: 1 },
    boulderField: 1,
    beaches: true,
    shore: { sand: 1 },
    // A SKERRY COAST IS A SHELTERED ONE. The islands stand between the
    // shore and the open sea, so the ocean's swell arrives broken and
    // small and the wind sea inside them never builds to what the same
    // wind grows over open water. Somewhat under the rule book's — the
    // waves are still the game — and the mangrove coast's row is where the
    // whole swell comes ashore.
    sea: { wind: 0.85, swell: 0.7 },
    // R19 — a northern summer, which is every sky there is here. A cold
    // coast in July runs from a windless blue morning to a line squall
    // coming in off the open sea in an afternoon, and the whole point of
    // hanging the draw on the wind is that both are on the same chart. No
    // haze: that is warm water's sky.
    weathers: ["clear", "high", "overcast", "rain", "squall"],
    // R20 — a cold brackish sea's own, listed the way it is met: the
    // shore's fish and the sea trout along it, the grey seal off every
    // skerry, the porpoise in the sounds — and then the open water past
    // them, where the salmon run and the cod hold and the white-beaked
    // dolphins, the basking shark and the three great whales are. The
    // catalog's `offshore` is what puts each of them at its own distance;
    // its `perKm` is what keeps the far ones worth riding out for.
    fauna: [
      "herring",
      "roach",
      "perch",
      "pike",
      "seatrout",
      "seal",
      "porpoise",
      "salmon",
      "cod",
      "whitebeak",
      "basking",
      "orca",
      "minke",
      "humpback",
    ],
  },
  mangrove: {
    id: "mangrove",
    name: "Mangrove coast",
    // Full salt — 1024 kg/m³ — and warm the whole year: the sea off a low
    // subtropical coast runs from about 18 °C in the coolest month to 30 °C
    // and over in late summer, and the shallow flats behind the sandbars
    // cook a few degrees warmer still. The bands are the same dated months
    // the taiga's are (`DECLINATION`): May already warm, late July at its
    // hottest, early October barely off it, mid-November the first cool
    // water of the year.
    water: {
      density: 1024,
      temperature: {
        spring: { min: 24, max: 28 },
        summer: { min: 29, max: 32 },
        autumn: { min: 26, max: 29 },
        winter: { min: 19, max: 24 },
      },
    },
    // Subtropical: the sun stands eighty degrees up at a midsummer noon and
    // forty at a midwinter one, the days run eleven to fourteen hours the
    // year round, and every night is black — a dusk of twenty minutes and
    // then the stars. The opposite of the taiga's light in every rung.
    latitude: 27,
    // Nothing stands higher than a dune. A third of the taiga's plateau
    // puts the tallest ground on the coast a few metres over the water.
    relief: 0.3,
    // …and it rises to that over the whole reach: a beach, a dune, the
    // flat behind it. Nothing on this coast stands up out of the water.
    climb: 1,
    // A flat coast's river is an ESTUARY. It comes out through a mouth
    // opened wider than the channel behind it, holds its width a long way
    // up the country before it closes — a lowland river loses its
    // tributaries slowly — bends in loops half as wide again as the rock
    // channel's, and carries a fraction of the water: a warm shelf's
    // rivers are short and the current in them is a drift. And it comes
    // out through BARS — two to four low islands standing in the mouth's
    // own reach, the sand and mud the river dropped where it met the sea,
    // which is what turns a mouth into a delta from the saddle: a rider
    // leaving the race up the river threads between them.
    river: {
      mouth: 1.35,
      head: 1.6,
      taper: 0.65,
      bend: 1.5,
      discharge: 0.35,
      bars: {
        count: { min: 2, max: 4 },
        r: { min: 7, max: 16 },
        reach: { min: 40, max: 260 },
        channel: 8,
      },
    },
    // No standing rock to speak of: the odd low limestone islet where the
    // taiga has a skerry, sandbars and coral heads awash where it has
    // reefs, and none of the ice's leavings at all — no boulders, no
    // erratics, no sea stack. The ocean leg's MARK (R25) is placed by the
    // line and still stands; it is the one rock a mangrove seed is sure of.
    rocks: { skerry: 0.08, boulder: 0, reef: 0.5, erratic: 0, stack: 0 },
    // …but the classifier's "rock" SURFACE is kept, at four fifths of the
    // taiga's spread: on this coast it is the oyster bars and the coral
    // rubble that break up a stretch of marl, and without it a sheltered
    // channel is one material from end to end and R21 refuses the level.
    // MEASURED over sixteen seeds: no field at all builds nine of them, this
    // builds all sixteen, as the taiga does.
    boulderField: 0.8,
    beaches: true,
    // More beach than the taiga, and mangrove where the beach is not — the
    // sheltered stretches keep the rule book's own "bedrock", which on this
    // coast is a low shelf of marl and shell the mangroves stand on rather
    // than a slab of granite. Held well short of the whole waterline so
    // R21's quilt survives: a bay of sand, then a mangrove point, then sand
    // again. MEASURED with the field above: 1.2 builds sixteen seeds of
    // sixteen, 1.35 fifteen, 1.75 four.
    shore: { sand: 1.2 },
    // A LOW OPEN COAST ON A WARM SHALLOW SHELF. The wind sea over it is
    // small — a sea breeze over a shelf a few metres deep never stands
    // up — and the groundswell is the whole ocean's, long, lazy and
    // unbroken by anything on the way in: the sets that come in over the
    // sandbars are what this coast's waves are.
    sea: { wind: 0.75, swell: 0.95 },
    // R19 — a subtropical year on one chart: bare blue and the milky haze
    // of a humid morning at the calm end, a high sheet and the winter
    // front's overcast in the middle, and at the top the rain and the
    // black afternoon storm that is this coast's own squall.
    weathers: ["clear", "haze", "high", "overcast", "rain", "squall"],
    // R20 — a warm shelf's, listed the way it is met. Over the flats and
    // along the mangrove edge: the mullet that leap, the snook and the
    // redfish in the roots, the ray on the sand, the manatee and the
    // loggerhead coming up to breathe, the tarpon rolling. Out in the
    // channels: the barracuda, the bottlenose, the bull shark, the green
    // turtle crossing between flats. And past the last of them, over the
    // outer shelf: the spotted dolphin schools, the tiger shark and the
    // hammerhead, the manta, the whale shark and this coast's own rorqual.
    fauna: [
      "mullet",
      "snook",
      "redfish",
      "stingray",
      "manatee",
      "turtle",
      "tarpon",
      "barracuda",
      "dolphin",
      "shark",
      "greenturtle",
      "spotted",
      "tiger",
      "hammerhead",
      "manta",
      "whaleshark",
      "brydes",
    ],
  },
};

/** The row for a biome id; throws for a coast that is not built yet. */
export function biomeOf(id: BiomeId): Biome {
  const row = BIOMES[id];
  if (!row) throw new Error(`biome "${id}" is not built yet (built: ${BIOME_IDS.join(", ")})`);
  return row;
}

/** Whether a string names a coast that is BUILT — what a URL, a stored
 * setting or a lab's flag is checked against before it is trusted. */
export function isBiomeId(id: unknown): id is BiomeId {
  return typeof id === "string" && BIOMES[id as BiomeId] !== undefined;
}
