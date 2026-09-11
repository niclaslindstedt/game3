// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GENERATOR'S OUTER LOOP: a seed in, a clean level out, or a thrown
// error that names what could not be made clean.
//
// A level is a pure function of its seed. Each ATTEMPT draws everything
// from a sub-seed derived from the seed and the attempt number — the
// shore, the geology, the conditions, the course, the rocks — compiles it,
// and asks the analysis (the same rule book, re-checked on the finished
// level rather than on the plan) whether it is clean. An attempt the
// search itself gives up on, or one the analysis finds a fault in, is
// rejected and the next sub-seed is tried; the attempts are bounded, the
// order is fixed, and so the level a seed produces is the same on every
// machine, and the reason it took three tries is in the log.
//
// Rejection is the honest outcome of a search that never ships a
// violation. A bay whose shelf never reaches R5's depth inside R1's band,
// a coast with no straight long enough for R9's run-up, a chord that cuts
// the shore: each is a coast that cannot carry a course, and the answer to
// that is a different coast, not a bent rule.
//
// TWO KINDS OF LEVEL come out of this one loop. A COAST (R24–R26) is a
// sprint along a shore, out to a mark and back, with a river running on
// inland past it. A CIRCUIT (R29–R31) is a closed lap out at sea, ridden
// several times round, with no river and the coast a long way off. They
// differ in the WATER — how the line is drawn and how the basin round it
// is cut — and in nothing else: the conditions, the rocks, the sea life,
// the sky and the compile are one path, drawn in one order, because none
// of them has an opinion about which kind of race is being laid.

import { createRng, type Rng } from "../lib/prng.ts";
import { TAU } from "../lib/math.ts";
import { DECLINATION, SEASONS, daylightWindow } from "../lib/solar.ts";
import { analyzeLevel } from "../analysis/index.ts";
import { warn } from "../output.ts";
import { biomeOf } from "./biomes.ts";
import { sampleField, type Heightfield } from "../lib/heightfield.ts";
import { bakeGround, compileLevel } from "./compile.ts";
import {
  circuitBounds,
  layBasin,
  layOceanBasin,
  levelBounds,
  oceanEdge,
  routeBounds,
  type Basin,
} from "./basin.ts";
import { drawCircuit } from "./circuit.ts";
import { drawRiver, type River } from "./river.ts";
import { drawRoute, type Route } from "./route.ts";
import {
  courseKeepOut,
  layCircuitCourse,
  layCourse,
  type CoursePlan,
  type Water,
} from "./course.ts";
import { layFauna } from "./fauna.ts";
import { createGeology, laySolids, type Geology } from "./geology.ts";
import { LEVEL_RULES as R, inBand, withinBand } from "./rules.ts";
import { pickWeather, skyCover } from "./weather.ts";
import type { Bounds, GenerateOptions, Level, Solid, TrackKind, Wind } from "./types.ts";

/** R15, R25 — where the open sea's straight edge stands, as a distance
 * along the sea's own heading. `sea.line.edge` short of the route's most
 * seaward station OUTSIDE the ocean leg — the same cut `layBasin` makes,
 * stated here for the river, which has to know where the sea is before the
 * basin has baked a field to read it off. Both read the route and the same
 * rule, so neither can drift from the other without the other's draw
 * moving too.
 *
 * The edge itself is a band; this takes its MIDDLE, because the river only
 * asks whether its mouth is up a channel or out in the open, and forty
 * metres of drawn edge does not change that answer. */
function seaEdge(route: {
  points: readonly { x: number; z: number }[];
  along: Float64Array;
  seaHeading: number;
  leg: { from: number; to: number };
}): number {
  const sx = Math.sin(route.seaHeading);
  const sz = Math.cos(route.seaHeading);
  let highU = -Infinity;
  for (let i = 0; i < route.points.length; i++) {
    if (route.along[i] >= route.leg.from && route.along[i] <= route.leg.to) continue;
    highU = Math.max(highU, route.points[i].x * sx + route.points[i].z * sz);
  }
  return highU - (R.sea.line.edge.min + R.sea.line.edge.max) / 2;
}

/** The sub-seed of an attempt: the golden-ratio stride keeps successive
 * attempts far apart in the generator's state space. */
export function subSeed(seed: number, attempt: number): number {
  return (seed + attempt * 0x9e3779b9) >>> 0;
}

/** THE WATER AN ATTEMPT DREW: the line the race is ridden on, the basin cut
 * round it, the ground under both, and the rocks that stood before the
 * course did. Everything the two kinds of level disagree about, in the one
 * shape the rest of the attempt reads. */
type Waters = {
  readonly route: Route;
  readonly river: River;
  readonly bounds: Bounds;
  readonly basin: Basin;
  readonly geology: Geology;
  readonly ground: Heightfield;
  /** R25, R31 — the marks, as the solids they will be published as. */
  readonly marks: readonly Solid[];
  /** The box the rocks and the sea life are scattered over (R17, R20). */
  readonly strewn: Bounds;
  /** How much coast that scattering is worth, km. */
  readonly km: number;
  readonly lay: (rng: Rng, water: Water, wind: Wind) => CoursePlan | null;
};

/** R26 — a circuit's river, which is no river: the empty line every reader
 * of one already treats as "there is none here". */
const NO_RIVER: River = {
  points: [],
  widths: new Float64Array(0),
  inland: 0,
  length: 0,
  discharge: 0,
};

/** R25, R31 — the marks the LINE placed, as the solids they are published
 * as: `M1…` for the sea stack a coast's ocean leg rounds, `B1…` for the lit
 * buoys a circuit's lap is ridden round, each carrying its own light. */
function markSolids(route: Route): Solid[] {
  return route.marks.map((mark, i) => ({
    id: `${mark.kind === "buoy" ? "B" : "M"}${i + 1}`,
    kind: mark.kind,
    x: mark.x,
    z: mark.z,
    r: mark.r,
    top: mark.top,
    ...(mark.light ? { light: { ...mark.light } } : {}),
  }));
}

/** R24, R25, R26, R15 — a coast: the route, the river off its most inland
 * station, and the basin cut round them both. */
function drawCoast(rng: Rng, biome: ReturnType<typeof biomeOf>): Waters | string {
  // R24 — THE ROUTE FIRST. Everything else in a level is built around the
  // line the race is ridden on, which is the whole inversion: a coast drawn
  // first can only ever be raced ALONG.
  const route = drawRoute(rng);
  if (!route) return "the route folds back on itself";
  // R26 — the river that runs on inland from the route's own mouth. It is
  // drawn before the water is carved, because it is part of what gets
  // carved: the basin stamps the river's line beside the route's.
  //
  // Its own sea edge is worked out here rather than asked of the basin,
  // because the basin needs the river to bake the field it would answer
  // from. It is the same line the basin cuts (`sea.line.edge` short of the
  // route's most seaward station outside the ocean leg) — and this is the
  // ONE place the two have to agree.
  const river = drawRiver(rng, route, seaEdge(route));
  if (!river) return "no river will run inland from this route";
  // R15 — then the water round them both, and the land it is cut out of.
  const bounds = levelBounds(route, river);
  const basin = layBasin(rng, route, river, bounds);
  const geology = createGeology(rng, biome, basin);
  const ground = bakeGround(basin.offshore, geology);
  // R25 — and the leg is only an ocean leg if it reached the ocean. Where
  // the walk strayed further seaward than the leg's own entry, the sea's
  // edge is cut past the apex and what was drawn as a run out to a mark
  // comes out as a bulge inside the band. Checked here, on the field, the
  // moment there is a field to check it on.
  const apex = sampleField(basin.offshore, route.leg.apex.x, route.leg.apex.z);
  if (!withinBand(apex, R.leg.offshore)) return `the ocean leg stands ${apex.toFixed(0)} m out`;
  return {
    route,
    river,
    bounds,
    basin,
    geology,
    ground,
    marks: markSolids(route),
    // The ROUTE'S box rather than the level's: the river carries the level
    // a kilometre inland (R26), and scattering a coast's worth of rock over
    // that plan by rejection would leave the water the race is actually
    // ridden through half as strewn as the rule says.
    strewn: routeBounds(route),
    km: route.length / 1000,
    lay: (rng2, water, wind) => layCourse(rng2, route, water, wind),
  };
}

/** R29, R31 — a circuit: the closed loop, and the open sea it stands in
 * with one coast cut a long way off on one side. */
function drawOcean(rng: Rng, biome: ReturnType<typeof biomeOf>): Waters | string {
  const route = drawCircuit(rng);
  if (!route) return "no loop this seed draws is rideable";
  // R29 — the coast is put where the loop is not: the sea's edge is cut
  // back from the loop's most inshore station by the whole of this level's
  // offshore distance, so the line stands out at sea by construction rather
  // than by a check.
  const shore = oceanEdge(rng, route);
  const bounds = circuitBounds(route, shore);
  const basin = layOceanBasin(route, bounds, shore);
  const geology = createGeology(rng, biome, basin);
  const ground = bakeGround(basin.offshore, geology);
  return {
    route,
    river: NO_RIVER,
    bounds,
    basin,
    geology,
    ground,
    marks: markSolids(route),
    // The loop's own box, opened out to the water beside it: a circuit's
    // race is ridden round the whole of that box rather than along one edge
    // of it, so the rocks are strewn over all of it.
    strewn: routeBounds(route),
    // A lap ridden two or three times is two or three times the water a
    // rider passes, and R17 counts rock by the kilometre a rider rides.
    km: (route.length * R.circuit.laps.max) / 1000,
    lay: (rng2, water, wind) => layCircuitCourse(rng2, route, water, wind),
  };
}

/** Generate a level from a seed. Deterministic; always satisfies the
 * R-rules or throws. */
export function generateLevel(seed: number, opts: GenerateOptions = {}): Level {
  const biome = biomeOf(opts.biome ?? "taiga");
  const track: TrackKind = opts.track ?? "coast";
  const attempts = opts.attempts ?? R.search.attempts;
  // R13 — the hours this coast is in daylight in each season, off its own
  // latitude. A fact about the place rather than about the attempt, so it
  // is worked out once, outside the loop and outside the seeded stream.
  const daylightIn = SEASONS.map((season) =>
    daylightWindow(biome.latitude, R.day.minSun, DECLINATION[season]),
  );
  if (daylightIn.some((w) => !w)) throw new Error(`the sun never rises on the ${biome.id} coast`);
  let lastReason = "no attempt made";
  for (let attempt = 0; attempt < attempts; attempt++) {
    const rng = createRng(subSeed(seed, attempt));
    const reject = (why: string): void => {
      lastReason = why;
      warn(`level ${seed}: attempt ${attempt} rejected — ${why}`);
    };
    const drawn = track === "circuit" ? drawOcean(rng, biome) : drawCoast(rng, biome);
    if (typeof drawn === "string") {
      reject(drawn);
      continue;
    }
    const { river, bounds, basin, geology, ground } = drawn;
    const offshoreAt = (x: number, z: number): number => sampleField(basin.offshore, x, z);
    const depthAt = (x: number, z: number): number => -sampleField(ground, x, z);
    // R17 — how far out into the OPEN SEA a point stands, m: the basin's own
    // straight sea edge (R15), signed, so a channel or a river is deeply
    // negative however wide it is. The basin folds this line into `offshore`
    // with `max`, which is exactly why the two cannot be read off one field:
    // once the corridor has won a cell, nothing downstream can tell whether
    // the water there is the sea's or a bay's.
    const seaX = Math.sin(basin.seaHeading);
    const seaZ = Math.cos(basin.seaHeading);
    const seawardAt = (x: number, z: number): number => x * seaX + z * seaZ - basin.seaOffset;
    // R12 — off the sea: the open water's own seaward normal, swung by up
    // to `wind.seaward` either way, so the fetch grows riding out from the
    // land whichever way the route wandered.
    const wind = {
      from: (((basin.seaHeading + rng.range(-R.wind.seaward, R.wind.seaward)) % TAU) + TAU) % TAU,
      speed: inBand(rng, R.wind.speed),
    };
    // R13 — the day and the water: WHERE in the daylight window the hour
    // falls and where in the season's band the water's temperature does,
    // each as a fraction. Both are resolved once the season is known,
    // which is not until the end of the stream (see below) — but the two
    // draws stay HERE, where they have always been, so that everything
    // drawn after them lands where it always did.
    const dayAt = rng.range(0, 1);
    const waterAt = rng.range(0, 1);
    // The basin is the expensive thing; the course in it is not. A draw
    // that cannot fit R9's two beam-on run-ups is usually a shuffle that
    // put the candidate gates in the wrong order, so the course is drawn
    // again before the basin is given up (`search.courseTries`).
    let course = null;
    for (let try_ = 0; try_ < R.search.courseTries && !course; try_++) {
      course = drawn.lay(rng, { offshoreAt, depthAt }, wind);
    }
    if (!course) {
      reject("the basin cannot carry a course");
      continue;
    }
    // R17, R25, R31 — the rocks. The MARKS first, where the line put them,
    // and then the density-placed rocks, kept off the course and off the
    // marks.
    const solids = laySolids(
      rng,
      biome,
      drawn.strewn,
      offshoreAt,
      geology.groundAt,
      drawn.km,
      courseKeepOut(course),
      seawardAt,
      drawn.marks,
      track,
    );
    // R19 — the sky, drawn LAST of the things the search judges. It is the
    // one thing about a level the search never judges: no sky makes a basin
    // unrideable, so a rule about the weather has no business moving the
    // route, the course or the rocks that the draws before it made.
    const weather = pickWeather(rng, biome.weathers, skyCover(wind.speed));
    // R13 — the SEASON, drawn after the sky for the same reason and before
    // the sea life because the sea life depends on it: the season decides
    // how cold the water is, and the water decides what swims in it. Then
    // the two fractions drawn up by the wind become an hour in THIS
    // season's daylight and a temperature in its band.
    const season = SEASONS[rng.int(0, SEASONS.length - 1)];
    const daylight = daylightIn[SEASONS.indexOf(season)] as { min: number; max: number };
    const hour = daylight.min + dayAt * (daylight.max - daylight.min);
    const band = biome.water.temperature[season];
    const water = {
      density: biome.water.density,
      temperature: band.min + waterAt * (band.max - band.min),
    };
    // R20 — the sea life, drawn after all of it: no animal moves a gate, so
    // nothing the search judged may depend on how many there turned out to
    // be. The rocks are already placed, because a pod is kept clear of
    // them.
    const fauna = layFauna(
      rng,
      biome,
      drawn.strewn,
      offshoreAt,
      depthAt,
      solids,
      water.temperature,
      drawn.km,
    );
    const level = compileLevel({
      seed,
      biome,
      track,
      bounds,
      offshore: basin.offshore,
      ground,
      geology,
      course,
      river,
      solids,
      fauna,
      wind,
      water,
      season,
      hour,
      weather,
    });
    const analysis = analyzeLevel(level);
    if (analysis.ok) return level;
    reject(
      analysis.findings
        .filter((f) => f.severity === "error")
        .map((f) => `${f.code}: ${f.message}`)
        .join("; "),
    );
  }
  throw new Error(
    `level generation failed for seed ${seed} after ${attempts} attempts: ${lastReason}`,
  );
}
