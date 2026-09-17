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
// its name; THREE rows are built. The taiga's is the coast every rule in
// `rules.ts` was written against — a cold northern skerry coast: low,
// glacially planed bedrock slabs sliding into brackish water, boulder
// fields the ice left behind, gravel and sand collecting in the bays,
// skerries and reefs a stone's throw out, and the open sea broken up by
// the islands before it ever reaches the shore. The mangrove's is its
// opposite in nearly every row: a flat, warm, salt coast of white sand and
// mangrove, nothing standing higher than a dune, no rock to speak of, and
// a clear turquoise sea with a long lazy groundswell in it. The arctic's is
// the third kind of shore there is: a WALL OF ICE — a glacier's front
// standing forty metres out of the sea, with moraine and gravel in the
// bays between the fronts, bergs grounded off it where the taiga has
// skerries, a crack in the ice where the taiga has a river, and water at
// the freezing point that is ice for half the year (R37). Asking for an
// unbuilt biome throws, by design: a level on a coast nobody has drawn is
// not a level.

import type { FaunaId } from "../game/defs/fauna.ts";
import { DECLINATION, type Season } from "../lib/solar.ts";
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
  /** Whether the river has BANKS of its own (R16, R26): soil and grass
   * down to the water, whatever the coast either side of the mouth is
   * made of. False on a coast whose river is a crack in ice: its sides are
   * the coast's own material, the classifier never calls them bank, and
   * the analysis does not ask for one. */
  readonly banks: boolean;
  /** A CRACK RATHER THAN A MEANDER (R26): how much of the walk's turning
   * is bang-bang — straight reaches joined by corners at the channel's
   * tightest circle, the way a fracture runs along its joints — against
   * the smooth swing a river that cut its own valley has. 0 is the
   * meander, every other coast's; 1 is all of it, and with `bend` small
   * the corners close to the plan of a crack. */
  readonly kink: number;
  /** RAGGED WALLS (R26): how far the water's half-width wanders along the
   * reach, as a share of itself — pockets and pinches in the walls, on a
   * short period, over the taper. 0 on a coast whose river's banks are
   * the smooth cut of its own water. Never widens the mouth past R1's
   * ceiling: the wander is clipped to it. */
  readonly ragged: number;
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
  /** WHEN IN THE YEAR EACH SEASON IS, on this coast, as the sun's
   * declination on the season's middle day, degrees (R13). The seasons
   * are meteorological and so are dated to a PLACE (`DECLINATION` is the
   * taiga's dating, and the mangrove keeps it because a warm coast's year
   * has no reason to be dated otherwise), but a coast whose sea is ice
   * for half the year has a different year: its winter water is the weeks
   * the sun is back over the ice, not the weeks it is under the horizon.
   * The generator refuses a season the sun never rises in, so a row here
   * is what lets a polar coast be ridden in four seasons at all. */
  readonly declination: Record<Season, number>;
  /** Multiplier on `LEVEL_RULES.land.plateau` — how high this coast's land
   * stands against the rule book's band (1 is the taiga's). Held under
   * the coast's ceiling whatever it is. */
  readonly relief: number;
  /** THE COAST'S CEILING (R2): a multiple of `LEVEL_RULES.land.maxHeight`
   * nothing on this coast stands higher than. One on every coast whose
   * land is rock — the rule's forty-five metres is a headland's — and over
   * one on the one coast whose shore is a glacier's front: a tidewater ice
   * cliff runs thirty to seventy metres, and a coast held to the rock's
   * roof stood its walls at half that. */
  readonly ceiling: number;
  /** Multiplier on `LEVEL_RULES.land.hill.high` — how much taller than
   * the plateau a RUGGED stretch stands, over the rule book's own two
   * (R2, R21). One on the taiga; over one on a coast whose headlands are
   * something else entirely from its bays, so the soft stretches keep the
   * rule's low moraine while the rugged ones climb to the ceiling. */
  readonly headland: number;
  /** HOW STEEPLY THE LAND COMES DOWN TO THE WATER: the share of
   * `LEVEL_RULES.land.reach` over which the shore climbs to its hill
   * (R2) on the most RUGGED stretch of the coast. 1 is the taiga's low rise
   * over the whole reach; under it the same hill is met sooner — a coast of
   * steep banks and headlands falling straight into the sea — and the
   * ground is flat from there. The soft stretches (R21) climb over the
   * whole reach whatever this says: the character is what separates a
   * wall from the bay beside it, and a coast that fell into the sea as a
   * wall everywhere would be one material along its whole waterline. Never
   * over 1: the offshore field stops measuring at `land.measured`, and
   * R2's check reads the profile against the full reach. With `relief`
   * this is the landscape: low and gentle, low and steep, high and gentle,
   * high and steep are four different coasts. */
  readonly climb: number;
  /** WHERE ON THE CHARACTER THE WALL STARTS AND WHERE IT IS WHOLE (R2,
   * R21), and THE FOOT IT STANDS ON. `climb` and `headland` are applied
   * over one ramp: nothing under `from`, all of it from `to` up, smoothed
   * between. The taiga's ramp runs from a third of the way up the
   * character to the top — its `climb` is 1 and its `headland` 1, so the
   * ramp moves nothing, and it is stated so a coast without a wall stands
   * exactly where it always has. A wall coast pulls both ends down, so
   * the wall is the coast's ordinary shore and the moraine slope the
   * exception — and can, because of the APRON: a wall does not come out
   * of the water at the waterline cell but `apron` metres behind it, on a
   * foot of the rubble it has dropped, which is what a calving front
   * stands on and what lets the classifier read the foot off its own
   * slope (R16) — a boulder field, or sand on the softest stretch —
   * rather than calling every wall's foot bedrock and running R21's
   * quilt out. Zero apron on a coast with no wall. */
  readonly wall: {
    readonly from: number;
    readonly to: number;
    readonly apron: number;
  };
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
  /** WHETHER THIS COAST'S SEA FREEZES (R37): in its winter the level is
   * ridden down an icebreaker's channel through a sheet of ice. A coast
   * whose winter water stays over the freezing point never does. */
  readonly freezes: boolean;
  /** What SWIMS on this coast (R20) — ids from `engine/game/defs/fauna.ts`.
   * How often each is met is the catalog's `perKm`, not the biome's: a
   * coast says which animals are possible, the animal says how rare it is.
   * A coast that offers none simply has no life in its water. */
  readonly fauna: readonly FaunaId[];
};

/** Every biome that is BUILT, in the order they are offered. */
export const BIOME_IDS: readonly BiomeId[] = ["taiga", "mangrove", "arctic"];

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
    declination: DECLINATION,
    relief: 1,
    ceiling: 1,
    headland: 1,
    climb: 1,
    wall: { from: 0.35, to: 1, apron: 0 },
    // A skerry coast's river is a ROCK CHANNEL: it leaves through the one
    // gap the ice left in the granite, no wider than the race's own water,
    // closes fast to a creek between slabs, bends tight, and carries a
    // northern catchment's worth of water out — the torrent of the two
    // coasts. No delta: there is no sediment to build one from, and the
    // mouth is a sound, not a fan. The rule book's own numbers, which is
    // what the ones mean.
    river: {
      mouth: 1,
      head: 1,
      taper: 1,
      bend: 1,
      discharge: 1,
      banks: true,
      kink: 0,
      ragged: 0,
      bars: null,
    },
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
    // A brackish northern sea does freeze — but not in the weeks its winter
    // is dated to (`DECLINATION`), which are the last open water before it.
    freezes: false,
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
    declination: DECLINATION,
    // Nothing stands higher than a dune. A third of the taiga's plateau
    // puts the tallest ground on the coast a few metres over the water.
    relief: 0.3,
    ceiling: 1,
    headland: 1,
    // …and it rises to that over the whole reach: a beach, a dune, the
    // flat behind it. Nothing on this coast stands up out of the water.
    climb: 1,
    wall: { from: 0.35, to: 1, apron: 0 },
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
      banks: true,
      kink: 0,
      ragged: 0,
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
    freezes: false,
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
  arctic: {
    id: "arctic",
    name: "Arctic coast",
    // Full salt and at the freezing point: sea water freezes at −1.8 °C,
    // and the surface off a polar coast sits within a degree or two of it
    // for most of the year — under the ice it IS that, and in the weeks
    // of open water a metre of glacier melt lies on top of the sea and
    // warms to a few degrees over it. 1027 kg/m³ is the polar surface
    // water's own. The seasons are this coast's own weeks (`declination`
    // below): the ice going out, high summer, the sea freezing over, and
    // the sun back over the ice.
    water: {
      density: 1027,
      temperature: {
        spring: { min: -1.5, max: 1 },
        summer: { min: 1, max: 6 },
        autumn: { min: -1, max: 3 },
        winter: { min: -1.8, max: -0.5 },
      },
    },
    // High Arctic: eleven degrees past the polar circle. The sun is up for
    // four months without setting and down for nearly four without rising,
    // stands twelve degrees up at an equinox noon and thirty-five at
    // midsummer's, and the whole character of the light is that it comes
    // in LOW — under the cloud, along the water, off the ice.
    latitude: 78,
    // THIS COAST DATES ITS OWN YEAR, because the taiga's dating puts its
    // winter in a November this coast has no sun in. A polar coast's four
    // riding seasons are: SPRING in late May (+21°), the midnight sun a
    // month old and the fjord ice going out; SUMMER in late July (+20°),
    // the open-water weeks, and the fog season; AUTUMN in late September
    // (−2°), the sun ten degrees up at noon and the first nights dark
    // enough for stars, the sea about to freeze; and WINTER in early March
    // (−6.5°), the sun a fortnight back over the horizon and the sea a
    // sheet of ice two metres thick — which is the season R37 breaks a
    // channel through. The two summer rows never set (a level in either is
    // dealt any hour of the clock); the two winter rows give a six-hour
    // day and a night eighteen degrees under.
    declination: { spring: 21.0, summer: 20.0, autumn: -2.0, winter: -6.5 },
    // THE ICE WALL. A tidewater glacier's front stands thirty to seventy
    // metres above the water — the modelled stable cliff is sixty-five to
    // seventy-seven, the big outlet fronts run to eighty and the tallest
    // to two hundred — and the rule book's `land.maxHeight` is a rock
    // headland's 45 m, so this coast carries its own CEILING: half as much
    // again, sixty-seven metres, which is where the front stands on most
    // draws. Getting there is the HEADLAND factor rather than the relief:
    // the relief is near twice the taiga's plateau and no more, because
    // the soft stretches (R21) keep their share of the same plateau and
    // those are the coast's other half — a low moraine of gravel and
    // boulders between one front and the next, a few metres over the
    // water — and a relief that put the bays at a headland's height made
    // every one of them a slope the classifier calls bedrock, and the
    // coast one material. Trebling what a rugged stretch climbs to instead
    // lifts the fronts alone, over the wall's own ramp (`wall`), so the
    // soft bays stand where they did and the front stands at the ceiling.
    relief: 1.8,
    ceiling: 1.5,
    headland: 3,
    // …and on a rugged stretch it comes down as a WALL. The whole climb is
    // met over a sixteenth of the taiga's reach — six metres of plan for
    // forty of height — which is as near vertical as a heightfield with a
    // four-metre cell can be asked for, and the classifier calls every
    // face steeper than `surface.bedrockSlope` bedrock, so the wall is one
    // material from the waterline to its lip and the glacier's surface
    // behind it is flat from there. The soft stretches climb over the
    // whole reach, as every coast's do: those are the moraine slopes
    // between one front and the next, where the gravel and the boulder
    // fields are, and where a rider can actually get out of the water.
    climb: 0.06,
    // …and it is the ORDINARY shore of this coast, not its headlands: the
    // wall starts a quarter of the way up the character and is whole by
    // the middle of it, so only the softest bays are the moraine slopes
    // where the gravel and the sand are. It can be, because the wall
    // stands on an APRON: fourteen metres of the rubble it calves onto,
    // level to the water, so the waterline reads as the boulder field it
    // is (R16) and the quilt (R21) is the field's to break rather than the
    // slope's. A wall without one was bedrock from its foot to its lip,
    // and to keep the quilt the coast had to keep two stretches in three
    // as low moraine — which put the front on one seed's course in four.
    wall: { from: 0.25, to: 0.5, apron: 14 },
    // A CRACK IN THE ICE, where the taiga has a river. A rift in an ice
    // front holds its width for most of its length — the walls are
    // parallel sheer ice, tens of metres apart, and the crack pinches to
    // nothing at its head rather than closing on a taper — so the mouth is
    // the race's own water and the width is held far up the country. It
    // bends as a rock channel does — R26's sinuosity floor is the same on
    // every coast, and a crack kinks its way inland as much as a river
    // winds. What runs down it is a fraction of a torrent, the glacier's
    // own melt draining out through its front in summer and the tide the
    // rest of the year. And it has NO BANKS: the crack's sides are the
    // wall's own ice, so the classifier never calls them bank and R26 does
    // not ask it to (`banks`). No bars either: ice drops no sediment to
    // build one from.
    river: {
      mouth: 1,
      head: 1,
      taper: 0.55,
      // Half the taiga's circle, and the walk's turning all bang-bang: a
      // crack runs straight along a joint and turns at the next one, so
      // the plan is reaches and corners rather than loops — and its walls
      // wander by nearly half their width over a few boat lengths, the
      // pockets and pinches a fracture through ice has and a river's cut
      // bank never does.
      bend: 0.5,
      discharge: 0.2,
      banks: false,
      kink: 1,
      ragged: 0.45,
      bars: null,
    },
    // WHAT STANDS IN THIS WATER IS ICE. A skerry on this coast is a berg
    // grounded off the front, a reef a growler awash, a stack the tallest
    // berg on the level — all of them carved by the same placer in the
    // coast's own stone (`shore-paint.ts`), which here is blue-white — and
    // the boulders and the erratics are the real thing: a glacier's front
    // is where the moraine is, and the blocks it dropped stand on the
    // gravel below it thicker than on any other coast.
    rocks: { skerry: 0.55, boulder: 1.3, reef: 0.6, erratic: 1.6, stack: 0.7 },
    // A moraine is boulder to the water: the widest field of the three.
    // MEASURED over sixteen seeds with the sand row below: all sixteen
    // build.
    boulderField: 1.4,
    beaches: true,
    // The "sand" is the moraine's gravel — grey, coarse, and in the bays
    // between the fronts only. Somewhat under the taiga's: most of this
    // waterline is ice or the boulders under it, and the gravel is what
    // breaks the two up for R21's quilt.
    shore: { sand: 0.85 },
    // A COAST HEMMED IN BY ICE. The pack stands off it most of the year and
    // the fjord's own fetch is short, so the wind sea is the taiga's or a
    // little under; and the groundswell is half gone — the ice edge takes
    // most of a swell's height out of it in a few kilometres, which is why
    // the sea inside the pack is the flattest in the game and why the
    // winter sheet (R37) forms on it at all.
    sea: { wind: 0.7, swell: 0.5 },
    // R19 — a polar year on one chart. The haze is this coast's SEA
    // SMOKE: air thirty degrees colder than the water it crosses, standing
    // over every lead as a low white fog. Overcast is the ordinary sky
    // here — a polar coast is under stratus most of the year — and the rain
    // and the squall are SNOW and a BLIZZARD, a white sky and a white-out,
    // painted so in `sky-looks.ts`.
    weathers: ["clear", "haze", "high", "overcast", "rain", "squall"],
    // R37 — and in its winter the sea is a sheet of ice with a channel
    // broken through it: the whole reason the winter is dated to March.
    freezes: true,
    // R20 — the ice edge's own, listed the way it is met. Under the ice
    // and along the front: the polar cod in the cracks, the capelin
    // shoaling on the gravel, the char out of the crack in summer, the
    // ringed seal at its hole and the bearded seal on the floe, the polar
    // bear swimming the lead. Out past them: the walrus, the beluga
    // herd, the harp seals, the killer whale come in for them — and then
    // the two things nobody sees anywhere else, the narwhal's tusk and the
    // bowhead's blow, and the sleeper shark that never comes up at all.
    // The minke and the humpback are the summer's, as they are on the
    // taiga, and their rows are the taiga's own.
    fauna: [
      "polarcod",
      "capelin",
      "char",
      "ringed",
      "bearded",
      "polarbear",
      "harp",
      "walrus",
      "beluga",
      "orca",
      "minke",
      "narwhal",
      "humpback",
      "sleeper",
      "bowhead",
    ],
  },
};

/** The row for a biome id; throws for a coast that is not built yet. */
export function biomeOf(id: BiomeId): Biome {
  const row = BIOMES[id];
  if (!row) throw new Error(`biome "${id}" is not built yet (built: ${BIOME_IDS.join(", ")})`);
  return row;
}

/** THE SUN'S DECLINATION on this coast in this season, degrees — the one
 * reading of where in the year a season falls, for everything that puts
 * the sun somewhere: the generator's daylight window (R13), the analysis
 * that re-checks it, the rating's sun axis, and the app's sky. */
export function declinationOf(biome: BiomeId, season: Season): number {
  return biomeOf(biome).declination[season];
}

/** Whether a string names a coast that is BUILT — what a URL, a stored
 * setting or a lab's flag is checked against before it is trusted. */
export function isBiomeId(id: unknown): id is BiomeId {
  return typeof id === "string" && BIOMES[id as BiomeId] !== undefined;
}
