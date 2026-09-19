// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CAMPAIGN'S SHORES, and the six levels each of them runs. Every level
// is a SEED plus the dials it is built at and the day it is ridden in —
// the shores are generated, not authored — so a shore is a short table of
// them with the name the menu shows. Curating one is `make rate` and `make
// difficulty`'s job, and the numbers here are their output.
//
// EVERY LEVEL NAMES THE GENERATOR THAT BUILT IT (`engine/mapgen/versions.ts`)
// and carries the DIGEST of the shore that came out, and both are written
// out on every level rather than shared from a constant on purpose: a shared
// version is a single edit that re-rolls the whole campaign, which is the
// implicit move the field exists to make impossible, and a digest is a
// claim about ONE shore. `tests/generator_version_test.ts` rebuilds every
// level and holds it to its digest, so a rule moving under one of these is
// a red suite rather than a silent re-roll — and when it goes red, the
// question is which of the two it was: a level deliberately moved (write
// the new digest down, re-rate, re-name), or the rules moving out from
// under one (add a version row, keep the old behaviour on the old row).
//
// A LEVEL IS NAMED FOR WHAT IT IS LIKE, never for where it is: the water,
// the light, the shape of the ask. A biome is a kind of coast and nothing
// in this tree names a place (`tests/biome_test.ts`).
//
// THE RUNG ORDER is the same on every shore — a race, a tricks run, a
// lapped circuit, a race, a tricks run, the finale — so the second
// discipline is met second rather than fifth, the loop is inside the climb
// rather than bolted on the end, and every rung asks more than the one
// before it on `make rate CAMPAIGN=1`'s index, with the day (the hour, the
// season, the sky, the wind) carrying a third of the climb. The seeds were
// picked from a sweep of the first forty-eight of each coast, as races, as
// tricks runs and as circuits (`make rate COUNT=48 …`), on the brief the
// rating module's header states: climb without a wall, no two rungs the
// same shore twice, every kind of ask led on somewhere.
//
// THE MEDALS on a tricks level are set against the bot's own afternoon —
// the roster ridden by the bot on the pinned shore under the pinned day,
// which is what the curation loop measures (`tests/campaign_test.ts`
// quotes the run). The bot never flips, so its total is very nearly its
// air time priced, and BRONZE STANDS WELL UNDER THE ROSTER'S MEDIAN,
// about a fifth of it: a medal is the DOOR to the next rung and nothing
// else, while what the rung PAYS is the podium it is placed on, and a door
// a rider has to out-ride eleven machines to get through would be the lock
// twice. From there the ladder is 1 : 3 : 6 on every level in the
// campaign — silver about a flip a jump on top of bronze, gold two —
// because the multiplier a revolution buys (`engine/game/tricks.ts`) is
// what stretches the ask, not more air.

import type { GeneratorVersion, Season, TrackKind, Weather } from "@engine";

/** The two games a campaign level is played as. A time trial is a race
 * with nobody else on it and a free ride measures nothing, so neither is a
 * rung. */
export type CampaignMode = "race" | "tricks";

/** The three medals a tricks level pays, best last. */
export const MEDALS = ["bronze", "silver", "gold"] as const;
export type Medal = (typeof MEDALS)[number];

export type CampaignLevel = {
  id: string;
  name: string;
  /** One line of billing on the level's box. */
  blurb: string;
  seed: number;
  mode: CampaignMode;
  /** R29 — a shore sprint or a lap out at sea — and, on a circuit, how many
   * laps the shore deals (R30): the shore's own number, quoted here so the
   * box can bill it without a build, and held to the built level by
   * `tests/generator_version_test.ts`. */
  track: TrackKind;
  laps?: number;
  /** WHICH GENERATOR built this shore (`mapgen/versions.ts`). Required on
   * every level rather than on the shore, because it is the one thing
   * about a campaign level that a change somewhere else can take away. */
  version: GeneratorVersion;
  /** The fingerprint of the shore this level was curated on, as
   * `levelDigest` reads it — `make rate CAMPAIGN=1` prints the one that
   * builds today. */
  digest: string;
  /** THE DAY, pinned: where the sun stands at the start (0..24), the season
   * the arc is drawn in, the sky, the mean wind (m/s, inside R12's band),
   * and the groundswell standing off the coast (m, inside `SWELL_DIAL`).
   * The same every time the level is ridden, so a time on it is a time on
   * THIS water. */
  hour: number;
  season: Season;
  weather: Weather;
  wind: number;
  swell: number;
  /** A tricks level's length, minutes, and what its three medals cost. */
  minutes?: number;
  medals?: Record<Medal, number>;
};

export type CampaignShore = {
  id: "mangrove" | "taiga" | "arctic" | "karst";
  name: string;
  blurb: string;
  levels: readonly CampaignLevel[];
};

/** THE WARM SHORE — the first, and the campaign's opening hour: flat water
 * over white sand, a lazy loop, then the swell that came in from somebody
 * else's weather and, last, the squall. */
const MANGROVE: CampaignShore = {
  id: "mangrove",
  name: "Mangrove",
  blurb: "White sand, warm water, and a swell from far off",
  levels: [
    {
      id: "mangrove-1",
      name: "Glass Water",
      blurb: "A metre of sea, no rocks, and the sun high",
      seed: 5,
      mode: "race",
      track: "coast",
      version: 1,
      digest: "343fd408",
      hour: 13,
      season: "summer",
      weather: "clear",
      wind: 7,
      swell: 1.5,
    },
    {
      id: "mangrove-2",
      name: "Low Hops",
      blurb: "Two minutes of kickers on flat water, in the haze",
      seed: 34,
      mode: "tricks",
      track: "coast",
      version: 1,
      digest: "ca3a8363",
      hour: 14,
      season: "autumn",
      weather: "haze",
      wind: 8,
      swell: 1.5,
      minutes: 2,
      medals: { bronze: 500, silver: 1500, gold: 3000 },
    },
    {
      id: "mangrove-3",
      name: "Lazy Laps",
      blurb: "Two laps out past the sand, with the sun going down",
      seed: 18,
      mode: "race",
      track: "circuit",
      laps: 2,
      version: 1,
      digest: "931504e7",
      hour: 18,
      season: "summer",
      weather: "haze",
      wind: 9,
      swell: 2,
    },
    {
      id: "mangrove-4",
      name: "Long Swell",
      blurb: "The ocean's own sea rolling under a grey lid",
      seed: 41,
      mode: "race",
      track: "coast",
      version: 1,
      digest: "680b58cd",
      hour: 16,
      season: "autumn",
      weather: "overcast",
      wind: 11,
      swell: 6,
    },
    {
      id: "mangrove-5",
      name: "Wet Kickers",
      blurb: "Four minutes of tight ramps in the rain",
      seed: 45,
      mode: "tricks",
      track: "coast",
      version: 1,
      digest: "0f3cda4f",
      hour: 8,
      season: "spring",
      weather: "rain",
      wind: 11,
      swell: 2.5,
      minutes: 4,
      medals: { bronze: 1500, silver: 4000, gold: 8000 },
    },
    {
      id: "mangrove-6",
      name: "Squall Line",
      blurb: "A big sea, rocks on the line, and the front coming through at dusk",
      seed: 39,
      mode: "race",
      track: "coast",
      version: 1,
      digest: "71dc1445",
      hour: 18,
      season: "spring",
      weather: "squall",
      wind: 13,
      swell: 9,
    },
  ],
};

/** THE COLD SHORE — the second, behind the warm one's table: granite
 * skerries on the line from the first rung, a longer night, and a bigger
 * sea at the end of it. */
const TAIGA: CampaignShore = {
  id: "taiga",
  name: "Taiga",
  blurb: "Granite, pine, and cold grey-green water",
  levels: [
    {
      id: "taiga-1",
      name: "Cold Calm",
      blurb: "Skerries either side of a flat line, early on a summer morning",
      seed: 26,
      mode: "race",
      track: "coast",
      version: 1,
      digest: "e7013a27",
      hour: 7,
      season: "summer",
      weather: "clear",
      wind: 7,
      swell: 1.5,
    },
    {
      id: "taiga-2",
      name: "Granite Kickers",
      blurb: "Two minutes of ramps threaded between the rocks",
      seed: 22,
      mode: "tricks",
      track: "coast",
      version: 1,
      digest: "2ae00e60",
      hour: 14,
      season: "spring",
      weather: "clear",
      wind: 8,
      swell: 1.5,
      minutes: 2,
      medals: { bronze: 600, silver: 1800, gold: 3600 },
    },
    {
      id: "taiga-3",
      name: "Iron Laps",
      blurb: "Two laps out at sea under a high sheet, rocks at the turns",
      seed: 10,
      mode: "race",
      track: "circuit",
      laps: 2,
      version: 1,
      digest: "633d011a",
      hour: 10,
      season: "spring",
      weather: "high",
      wind: 9,
      swell: 3,
    },
    {
      id: "taiga-4",
      name: "Head Sea",
      blurb: "A steep sea straight onto the bow, and the tightest corners on the coast",
      seed: 3,
      mode: "race",
      track: "coast",
      version: 1,
      digest: "c0a79382",
      hour: 12,
      season: "autumn",
      weather: "overcast",
      wind: 12,
      swell: 5,
    },
    {
      id: "taiga-5",
      name: "Winter Light",
      blurb: "Four minutes of kickers among the skerries, a low winter sun going",
      seed: 27,
      mode: "tricks",
      track: "coast",
      version: 1,
      digest: "5d0064f7",
      hour: 13,
      season: "winter",
      weather: "high",
      wind: 9,
      swell: 3,
      minutes: 4,
      medals: { bronze: 1000, silver: 3000, gold: 6000 },
    },
    {
      id: "taiga-6",
      name: "Grey Sea",
      blurb: "Nine metres of water, granite on the line, and the winter dark coming down",
      seed: 14,
      mode: "race",
      track: "coast",
      version: 1,
      digest: "2ef01c2b",
      hour: 14,
      season: "winter",
      weather: "overcast",
      wind: 13,
      swell: 12,
    },
  ],
};

/** THE POLAR SHORE — the third, behind the cold one's table: black water at
 * the freezing point under a wall of glacier ice, bergs grounded off the
 * front where the taiga has skerries, a midnight sun to open on and a
 * blizzard to close on — and, in the middle of it, the one thing no other
 * coast can put under a run: a sea frozen over, with a channel cut down the
 * course (R37). */
const ARCTIC: CampaignShore = {
  id: "arctic",
  name: "Arctic",
  blurb: "Glacier ice, black water, and a sea that freezes",
  levels: [
    {
      id: "arctic-1",
      name: "Midnight Sun",
      blurb: "Grounded bergs either side of a flat line, the sun still up at one",
      seed: 38,
      mode: "race",
      track: "coast",
      version: 1,
      digest: "d7e251ca",
      hour: 1,
      season: "summer",
      weather: "clear",
      wind: 7,
      swell: 1.5,
    },
    {
      id: "arctic-2",
      name: "Sea Smoke",
      blurb: "Two minutes of kickers in the fog that stands over every lead",
      seed: 46,
      mode: "tricks",
      track: "coast",
      version: 1,
      digest: "488334af",
      hour: 2,
      season: "summer",
      weather: "haze",
      wind: 8,
      swell: 2,
      minutes: 2,
      medals: { bronze: 700, silver: 2100, gold: 4200 },
    },
    {
      id: "arctic-3",
      name: "Floe Laps",
      blurb: "Three laps out past the front, under a high spring sheet",
      seed: 19,
      mode: "race",
      track: "circuit",
      laps: 3,
      version: 1,
      digest: "03e26448",
      hour: 3,
      season: "spring",
      weather: "high",
      wind: 9,
      swell: 4,
    },
    {
      id: "arctic-4",
      name: "Narrow Lead",
      blurb: "The sea frozen over, and the tightest line on the coast cut through it",
      seed: 2,
      mode: "race",
      track: "coast",
      version: 1,
      digest: "56b98d31",
      hour: 15,
      season: "winter",
      weather: "overcast",
      wind: 13,
      swell: 1.5,
    },
    {
      id: "arctic-5",
      name: "Snow Kickers",
      blurb: "Four minutes of ramps in the snow, with the sun going down for the year",
      seed: 45,
      mode: "tricks",
      track: "coast",
      version: 1,
      digest: "deefc154",
      hour: 16,
      season: "autumn",
      weather: "rain",
      wind: 12,
      swell: 6,
      minutes: 4,
      medals: { bronze: 1200, silver: 3600, gold: 7200 },
    },
    {
      id: "arctic-6",
      name: "White Out",
      blurb: "Nine metres of black water, growlers on the line, and a blizzard at last light",
      seed: 41,
      mode: "race",
      track: "coast",
      version: 1,
      digest: "ab837aaa",
      hour: 17,
      season: "autumn",
      weather: "squall",
      wind: 14,
      swell: 18,
    },
  ],
};

/** THE LIMESTONE SHORE — the fourth, behind the polar one's table: a sea
 * full of rock on the bluest water in the game, and the two things this
 * coast has that no other does — the ROCK, islets and reefs off every
 * headland from the first rung, and the SHORT STEEP SEA the north wind
 * stands up off the land in an hour. It opens on flat blue water among
 * the islets, hazes over in the heat of a summer afternoon, laps the
 * tightest circuit in the campaign, meets the southerly's grey sea, kicks
 * off the pebbles in the rain, and closes under the storm that comes off
 * the mountains as a black wall. */
const KARST: CampaignShore = {
  id: "karst",
  name: "Karst",
  blurb: "White rock, blue water, and a sea full of islets",
  levels: [
    {
      id: "karst-1",
      name: "Blue Water",
      blurb: "Flat water among the islets and reefs, the sun high and the stone white",
      seed: 16,
      mode: "race",
      track: "coast",
      version: 1,
      digest: "e7fe3c64",
      hour: 10,
      season: "summer",
      weather: "clear",
      wind: 7,
      swell: 1.5,
    },
    {
      id: "karst-2",
      name: "Heat Haze",
      blurb: "Two minutes of kickers on oily water, the horizon gone white in the heat",
      seed: 27,
      mode: "tricks",
      track: "coast",
      version: 1,
      digest: "e5cf8437",
      hour: 14,
      season: "summer",
      weather: "haze",
      wind: 8,
      swell: 1.5,
      minutes: 2,
      medals: { bronze: 700, silver: 2100, gold: 4200 },
    },
    {
      id: "karst-3",
      name: "Islet Laps",
      blurb: "Two laps of the tightest circuit in the campaign, at first light under a spring veil",
      seed: 12,
      mode: "race",
      track: "circuit",
      laps: 2,
      version: 1,
      digest: "15ea7ccc",
      hour: 7,
      season: "spring",
      weather: "high",
      wind: 10,
      swell: 3,
    },
    {
      id: "karst-4",
      name: "Southerly",
      blurb: "The warm wind up the sea, a grey lid, and reefs on the line in a rising chop",
      seed: 24,
      mode: "race",
      track: "coast",
      version: 1,
      digest: "eaefa45b",
      hour: 15,
      season: "autumn",
      weather: "overcast",
      wind: 12,
      swell: 5,
    },
    {
      id: "karst-5",
      name: "Limestone Kickers",
      blurb: "Four minutes of ramps off the pebbles in the southerly's rain",
      seed: 15,
      mode: "tricks",
      track: "coast",
      version: 1,
      digest: "b6a2c1b2",
      hour: 16,
      season: "autumn",
      weather: "rain",
      wind: 12,
      swell: 4,
      minutes: 4,
      medals: { bronze: 1200, silver: 3600, gold: 7200 },
    },
    {
      id: "karst-6",
      name: "Black Wall",
      blurb:
        "The storm off the mountains, nine metres of sea on the rock, and the last light of the year",
      seed: 47,
      mode: "race",
      track: "coast",
      version: 1,
      digest: "8eff5d03",
      hour: 15,
      season: "winter",
      weather: "squall",
      wind: 14,
      swell: 9,
    },
  ],
};

/** The shores in the order the campaign walks them: the warm one first, the
 * cold one behind its table, the polar one behind the cold one's, and the
 * limestone one behind the polar one's. */
export const SHORES: readonly CampaignShore[] = [MANGROVE, TAIGA, ARCTIC, KARST];

/** Every level, in ladder order. */
export const CAMPAIGN_LEVELS: readonly CampaignLevel[] = SHORES.flatMap((s) => s.levels);
