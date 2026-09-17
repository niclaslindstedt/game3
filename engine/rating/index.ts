// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// LEVEL RATING — how HARD a shore is, and what KIND of hard.
//
// `engine/analysis/` asks whether a level is BROKEN, and the generator will
// not hand one out that is. This asks the question that starts where that
// one stops: of two shores that both pass every rule, which asks more of
// the rider, and what does it ask for — the sea, the corners, the air, the
// rocks, the distance, the dark? A campaign is a LADDER of those answers,
// and it is built out of this module rather than out of the analyzer,
// because "no rule broken" says nothing about whether the second rung asks
// more than the first.
//
// EIGHT AXES, each 0..1 and none of them better than another. Five are the
// SHORE's and are read off the level (the sea, the corners, the air, the
// rocks, the length); three are the DAY's and are read off what the run
// is ridden in (the wind, the dark, the sky) — because an hour, a weather
// and a wind are the cheapest levers the campaign has, they cost nothing
// that has to be re-verified, and a ladder that ignores them wastes a
// third of its climb. `difficulty` folds the eight into one number on the
// weights in `RATING`, about two thirds the shore and one third the day.
//
// The CHARACTER is the axes themselves, and a ladder is read off them as
// much as off the index: six shores that all lead on the sea are the same
// shore six times, however well they climb. `scripts/rate-level.mjs` prints
// both, and `scripts/difficulty-preview.mjs` draws the axes over the plan.
//
// Every scale here is a NORMALISER, not a rule: the number a raw
// measurement is divided by to land the population's spread in 0..1. They
// were read off a sweep of the first forty-eight seeds of both coasts, as
// races, as tricks runs and as circuits, and are meant to be moved when
// the generator moves; `make rate COUNT=48 ARGS=--stats` shows where the
// population sits against them, and an axis pinned at 1 or 0 for most of
// a sweep is measuring nothing.

import { HEAVINESS } from "../mapgen/weather.ts";
import { LEVEL_RULES } from "../mapgen/rules.ts";
import { rulesAtPace } from "../mapgen/pace.ts";
import { biomeOf } from "../mapgen/biomes.ts";
import type { Level, Weather } from "../mapgen/types.ts";
import { createSea, seaSummary } from "../game/water.ts";
import { angleDiff, clamp } from "../lib/math.ts";
import { sunAt, type Season } from "../lib/solar.ts";

/** What a level is RIDDEN IN, as opposed to what it is: the three things a
 * campaign level pins that the generator would otherwise deal. Each
 * defaults to the level's own. */
export type RunConditions = {
  /** Where the sun stands when the run starts, 0..24. */
  hour: number;
  season: Season;
  weather: Weather;
  /** Mean wind at 10 m, m/s — the sea is grown from it. */
  wind: number;
};

/** The eight axes, 0..1 each — see the header. */
export type RatingAxes = {
  /** How big the water under the line is: the significant height met
   * along the course, against `RATING.scale.sea`. */
  sea: number;
  /** How much the line asks of the hands: the share of the path bent
   * tighter than `TIGHT_FLOORS` × R23's floor, and the heading change per
   * kilometre. */
  corners: number;
  /** How much of the run is in the air: ramps per kilometre, the air
   * gates' and the trick field's alike. */
  air: number;
  /** How close the rocks stand: solids inside `ROCK_REACH` of the line,
   * per kilometre. */
  rocks: number;
  /** How far there is to ride: the course's length times its laps. */
  length: number;
  /** How hard it blows: the wind across R12's band. */
  wind: number;
  /** How little light there is: 0 with the sun high, 1 with it under the
   * horizon — a night run, or one that starts at dusk and rides into it. */
  dark: number;
  /** How heavy the sky is (`HEAVINESS`). */
  sky: number;
};

export type LevelRating = {
  seed: number;
  axes: RatingAxes;
  /** The one number the ladder climbs on — the weighted fold of the axes. */
  difficulty: number;
  /** The raw readings the axes were made from, for the table. */
  stats: {
    /** Mean Hs along the course, m. */
    hs: number;
    /** The biggest Hs met along it, m. */
    hsMax: number;
    /** Share of the path with a local radius under `TIGHT_FLOORS` × R23's
     * floor. */
    tight: number;
    /** Heading change per kilometre, rad/km. */
    sweepPerKm: number;
    /** Ramps per kilometre of ridden course. */
    rampsPerKm: number;
    /** Rocks within `ROCK_REACH` of the line, per kilometre. */
    rocksPerKm: number;
    /** Distance ridden, m — the course's length over every lap. */
    ridden: number;
    /** The sun's elevation at the start, degrees. */
    sunDeg: number;
  };
  conditions: RunConditions;
};

/** The rating's own numbers: the normalisers and the weights. */
export const RATING = {
  scale: {
    /** m of mean Hs along the line that reads as the whole axis, on a
     * SQUARE-ROOT law: what a hull answers to is a wave's steepness, and a
     * sea's steepness grows with the root of its height (a JONSWAP sea
     * keeps its shape as it grows), so doubling the water does not double
     * the ask. The sweep's medians sit at 1.6 m on a coast and 2.5 m on a
     * circuit, its top decile past ten metres (R36's biggest swells). */
    sea: 8,
    /** Share of the path bent tighter than `TIGHT_FLOORS` × R23's floor that
     * reads as a tight shore on its own: half the line in corners — the
     * sweep runs a sixth to two thirds, a trick field's line the higher. */
    tight: 0.5,
    /** rad/km of heading change that reads as the whole corners axis:
     * R22's floor is 3.5 rad over a 1.6 km sprint, and the tightest
     * shores the search builds reach about four times that. */
    sweepPerKm: 9,
    /** Ramps per km that read as all air: a race carries one or two a
     * kilometre (R7), a trick field three to five (R35's stride). */
    rampsPerKm: 5,
    /** Rocks a kilometre within reach of the line that read as a rock
     * garden: the skerry coast runs one to eight, the warm coast under
     * three. */
    rocksPerKm: 8,
    /** m ridden that reads as the whole length axis: three laps of the
     * longest circuit the second chapter allows. */
    ridden: 3 * LEVEL_RULES.circuit.length.max,
    /** Degrees of sun above the horizon below which the day starts to
     * read as dark; noon on a summer taiga is about fifty. */
    sunHigh: 25,
  },
  /** How the eight fold into one: the shore about two thirds, the day
   * about one third. */
  weight: {
    sea: 0.2,
    corners: 0.16,
    air: 0.1,
    rocks: 0.1,
    length: 0.1,
    wind: 0.12,
    dark: 0.14,
    sky: 0.08,
  } satisfies Record<keyof RatingAxes, number>,
} as const;

export const RATING_AXES: readonly (keyof RatingAxes)[] = [
  "sea",
  "corners",
  "air",
  "rocks",
  "length",
  "wind",
  "dark",
  "sky",
];

/** Metres of path between sea samples: the wave field is smooth at a
 * hundred metres and a course has a dozen or two of them. */
const SEA_STEP = 100;

/** How many path stations either side of a point a corner is read over.
 * The path is drawn at ten-metre stations and a radius read off three
 * neighbours is noise; three stations each way is a sixty-metre chord,
 * about what a hull spends turning in (R23's reasoning). */
const CORNER_SPAN = 3;

/** m either side of the line a rock is counted as IN REACH: R6 keeps
 * every solid a berth off the path, so what the rocks axis counts is the
 * ones standing just past it, inside the band a rider reads at speed. */
const ROCK_REACH = 40;

/** A radius under this many floors is a CORNER rather than a bend. */
const TIGHT_FLOORS = 1.5;

/** The conditions a level rides in when nothing pins them: its own. */
export function levelConditions(level: Level): RunConditions {
  return { hour: level.hour, season: level.season, weather: level.weather, wind: level.wind.speed };
}

function circumradius(
  a: { x: number; z: number },
  b: { x: number; z: number },
  c: { x: number; z: number },
): number {
  const ab = Math.hypot(b.x - a.x, b.z - a.z);
  const bc = Math.hypot(c.x - b.x, c.z - b.z);
  const ca = Math.hypot(a.x - c.x, a.z - c.z);
  const area2 = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
  return area2 < 1e-9 ? Infinity : (ab * bc * ca) / (2 * area2);
}

/** The local radius of the line at station `i`, read over `CORNER_SPAN`
 * stations either side (fewer at the ends). Infinity on a straight. */
export function cornerRadius(path: readonly { x: number; z: number }[], i: number): number {
  const a = Math.max(0, i - CORNER_SPAN);
  const c = Math.min(path.length - 1, i + CORNER_SPAN);
  if (a === i || c === i) return Infinity;
  return circumradius(path[a], path[i], path[c]);
}

/** THE RATING of one level, ridden under `conditions` (its own when none
 * are given). Builds the sea the run would ride — the one cost in here,
 * a few hundred milliseconds — so the sea axis is the water a rider meets
 * and not the wind that grew it. */
export function rateLevel(level: Level, given: Partial<RunConditions> = {}): LevelRating {
  const conditions: RunConditions = { ...levelConditions(level), ...given };
  const R = rulesAtPace(level.pace, level.rampWidth);
  const path = level.course.path;
  const laps = Math.max(1, level.course.laps);
  const ridden = level.course.length * laps;
  const km = Math.max(0.1, level.course.length / 1000);

  // THE SEA along the line, as the run would grow it from the pinned wind,
  // and in the SEASON the run is ridden in rather than the one the seed was
  // dealt — because on a coast that freezes, the season is what decides
  // whether there is a sea there at all (R37, `frozen`): a winter run is
  // ridden down a channel cut through a sheet of ice, and a lead grows a
  // fraction of the wind sea and none of the swell. Laid over the level the
  // way `createGame` lays it, so the water rated is the water ridden.
  const inSeason: Level =
    conditions.season === level.season ? level : { ...level, season: conditions.season };
  const sea = createSea(inSeason, level.seed, { from: level.wind.from, speed: conditions.wind });
  let hsSum = 0;
  let hsMax = 0;
  let samples = 0;
  let since = SEA_STEP;
  for (let i = 0; i < path.length; i++) {
    if (i > 0) since += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
    if (since < SEA_STEP) continue;
    since = 0;
    const { Hs } = seaSummary(sea, path[i].x, path[i].z);
    hsSum += Hs;
    hsMax = Math.max(hsMax, Hs);
    samples += 1;
  }
  const hs = samples > 0 ? hsSum / samples : 0;

  // THE CORNERS: how much of the path is bent tighter than twice the
  // floor, and how far the heading turns per kilometre. Two readings
  // because they catch different shores — a line of hairpins joined by
  // straights, and a line that never stops turning.
  let tightLength = 0;
  let sweep = 0;
  let length = 0;
  for (let i = 1; i + 1 < path.length; i++) {
    const seg = Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
    length += seg;
    const r = cornerRadius(path, i);
    if (r < TIGHT_FLOORS * R.course.radius) tightLength += seg;
    const h0 = Math.atan2(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
    const h1 = Math.atan2(path[i + 1].x - path[i].x, path[i + 1].z - path[i].z);
    sweep += Math.abs(angleDiff(h0, h1));
  }
  const tight = length > 0 ? tightLength / length : 0;
  const sweepPerKm = sweep / km;

  // THE AIR: every deck on the level over the distance it is ridden in.
  const ramps = level.course.gates.filter((g) => g.ramp).length + level.ramps.length;
  const rampsPerKm = ramps / km;

  // THE ROCKS: solids standing within `ROCK_REACH` of the line — the ones
  // a rider has to steer for rather than merely see. Buoys and marks are
  // the course's own furniture and not counted.
  let near = 0;
  for (const s of level.solids) {
    if (s.kind === "buoy" || s.kind === "mark") continue;
    const reach = ROCK_REACH + s.r;
    let closest = Infinity;
    for (let i = 0; i + 1 < path.length; i += 2) {
      const d = Math.hypot(s.x - path[i].x, s.z - path[i].z);
      if (d < closest) closest = d;
    }
    if (closest <= reach) near += 1;
  }
  const rocksPerKm = near / km;

  // THE DAY: the sun where the run starts, and the sky over it.
  const biome = biomeOf(level.biome);
  const sunDeg =
    (sunAt(conditions.hour, biome.latitude, biome.declination[conditions.season]).elevation * 180) /
    Math.PI;
  const windBand = LEVEL_RULES.wind.speed;

  const axes: RatingAxes = {
    sea: clamp(Math.sqrt(Math.max(0, hs) / RATING.scale.sea), 0, 1),
    corners: clamp(
      0.5 * (tight / RATING.scale.tight) + 0.5 * (sweepPerKm / RATING.scale.sweepPerKm),
      0,
      1,
    ),
    air: clamp(rampsPerKm / RATING.scale.rampsPerKm, 0, 1),
    rocks: clamp(rocksPerKm / RATING.scale.rocksPerKm, 0, 1),
    length: clamp(ridden / RATING.scale.ridden, 0, 1),
    wind: clamp((conditions.wind - windBand.min) / (windBand.max - windBand.min), 0, 1),
    dark: clamp(1 - sunDeg / RATING.scale.sunHigh, 0, 1),
    sky: clamp(HEAVINESS[conditions.weather], 0, 1),
  };
  let difficulty = 0;
  for (const axis of RATING_AXES) difficulty += axes[axis] * RATING.weight[axis];

  return {
    seed: level.seed,
    axes,
    difficulty,
    stats: { hs, hsMax, tight, sweepPerKm, rampsPerKm, rocksPerKm, ridden, sunDeg },
    conditions,
  };
}

/** Which axis a level LEADS on — the one word its character is read as,
 * for a table and a level's box. */
export function leadingAxis(axes: RatingAxes): keyof RatingAxes {
  let best: keyof RatingAxes = "sea";
  for (const axis of RATING_AXES) if (axes[axis] > axes[best]) best = axis;
  return best;
}

/** How UNLIKE two shores are: the distance between their axes, 0 for the
 * same shore twice, about 1 for two that lead on different things. */
export function characterDistance(a: RatingAxes, b: RatingAxes): number {
  let sum = 0;
  for (const axis of RATING_AXES) sum += (a[axis] - b[axis]) ** 2;
  return Math.sqrt(sum / RATING_AXES.length) * 2;
}

/** What a LADDER of ratings does, read in the order they are played: does
 * it climb, is there a wall, are two rungs the same shore twice. Each is
 * a number a curator reads; a note names the rung when one is wrong. */
export type LadderReport = {
  /** The difficulty of each rung, in order. */
  asks: number[];
  /** The smallest step up between neighbours — negative where it steps
   * DOWN. */
  climb: number;
  /** The biggest step up between neighbours — a wall past `LADDER.wall`. */
  wall: number;
  /** The character distance of the two most alike rungs. */
  apart: number;
  notes: string[];
};

export const LADDER = {
  /** A step between rungs smaller than this is one a rider cannot feel. */
  step: 0.02,
  /** A step bigger than this is a wall. */
  wall: 0.2,
  /** Two rungs closer than this in character are the same shore twice. */
  apart: 0.25,
} as const;

export function rateLadder(rungs: readonly { name: string; rating: LevelRating }[]): LadderReport {
  const asks = rungs.map((r) => r.rating.difficulty);
  const notes: string[] = [];
  let climb = Infinity;
  let wall = -Infinity;
  for (let i = 1; i < rungs.length; i++) {
    const step = asks[i] - asks[i - 1];
    climb = Math.min(climb, step);
    wall = Math.max(wall, step);
    if (step < LADDER.step) {
      notes.push(
        `${rungs[i].name} asks ${step < 0 ? "less" : "no more"} than ${rungs[i - 1].name} (${step.toFixed(3)})`,
      );
    } else if (step > LADDER.wall) {
      notes.push(`${rungs[i].name} is a wall after ${rungs[i - 1].name} (+${step.toFixed(3)})`);
    }
  }
  let apart = Infinity;
  for (let i = 0; i < rungs.length; i++) {
    for (let k = i + 1; k < rungs.length; k++) {
      const d = characterDistance(rungs[i].rating.axes, rungs[k].rating.axes);
      if (d < apart) apart = d;
      if (d < LADDER.apart) {
        notes.push(
          `${rungs[i].name} and ${rungs[k].name} are the same shore twice (${d.toFixed(2)})`,
        );
      }
    }
  }
  return {
    asks,
    climb: rungs.length > 1 ? climb : 0,
    wall: rungs.length > 1 ? wall : 0,
    apart: rungs.length > 1 ? apart : 1,
    notes,
  };
}
