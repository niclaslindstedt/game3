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

import { createRng } from "../lib/prng.ts";
import { TAU } from "../lib/math.ts";
import { DECLINATION, SEASONS, daylightWindow } from "../lib/solar.ts";
import { analyzeLevel } from "../analysis/index.ts";
import { warn } from "../output.ts";
import { biomeOf } from "./biomes.ts";
import { sampleField } from "../lib/heightfield.ts";
import { bakeGround, compileLevel } from "./compile.ts";
import { layBasin, levelBounds, routeBounds } from "./basin.ts";
import { drawRiver } from "./river.ts";
import { drawRoute } from "./route.ts";
import { courseKeepOut, layCourse } from "./course.ts";
import { layFauna } from "./fauna.ts";
import { createGeology, laySolids } from "./geology.ts";
import { LEVEL_RULES as R, inBand, withinBand, type GenerateOptions } from "./rules.ts";
import { pickWeather, skyCover } from "./weather.ts";
import type { Level, Solid } from "./types.ts";

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

/** Generate a level from a seed. Deterministic; always satisfies the
 * R-rules or throws. */
export function generateLevel(seed: number, opts: GenerateOptions = {}): Level {
  const biome = biomeOf(opts.biome ?? "taiga");
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
    // R24 — THE ROUTE FIRST. Everything else in a level is built around
    // the line the race is ridden on, which is the whole inversion: a coast
    // drawn first can only ever be raced ALONG.
    const route = drawRoute(rng);
    if (!route) {
      lastReason = "the route folds back on itself";
      warn(`level ${seed}: attempt ${attempt} rejected — ${lastReason}`);
      continue;
    }
    // R26 — the river that runs on inland from the route's own mouth. It is
    // drawn before the water is carved, because it is part of what gets
    // carved: the basin stamps the river's line beside the route's.
    //
    // Its own sea edge is worked out here rather than asked of the basin,
    // because the basin needs the river to bake the field it would answer
    // from. It is the same line the basin cuts (`sea.line.edge` short of
    // the route's most seaward station outside the ocean leg) — and this
    // is the ONE place the two have to agree.
    const river = drawRiver(rng, route, seaEdge(route));
    if (!river) {
      lastReason = "no river will run inland from this route";
      warn(`level ${seed}: attempt ${attempt} rejected — ${lastReason}`);
      continue;
    }
    // R15 — then the water round them both, and the land it is cut out of.
    const bounds = levelBounds(route, river);
    const basin = layBasin(rng, route, river, bounds);
    const geology = createGeology(rng, biome, basin);
    const ground = bakeGround(basin.offshore, geology);
    const offshoreAt = (x: number, z: number): number => sampleField(basin.offshore, x, z);
    const depthAt = (x: number, z: number): number => -sampleField(ground, x, z);
    // R25 — and the leg is only an ocean leg if it reached the ocean. Where
    // the walk strayed further seaward than the leg's own entry, the sea's
    // edge is cut past the apex and what was drawn as a run out to a mark
    // comes out as a bulge inside the band. Checked here, on the field, the
    // moment there is a field to check it on.
    const apexOffshore = offshoreAt(route.leg.apex.x, route.leg.apex.z);
    if (!withinBand(apexOffshore, R.leg.offshore)) {
      lastReason = `the ocean leg stands ${apexOffshore.toFixed(0)} m out`;
      warn(`level ${seed}: attempt ${attempt} rejected — ${lastReason}`);
      continue;
    }
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
      course = layCourse(rng, route, { offshoreAt, depthAt }, wind);
    }
    if (!course) {
      lastReason = "the basin cannot carry a course";
      warn(`level ${seed}: attempt ${attempt} rejected — ${lastReason}`);
      continue;
    }
    // R17, R25 — the rocks. The MARK first, where the route put it, and
    // then the density-placed rocks over the route's own box, kept off the
    // course and off the mark.
    //
    // The ROUTE'S box rather than the level's: the river carries the level
    // a kilometre inland (R26), and scattering a coast's worth of rock over
    // that plan by rejection would leave the water the race is actually
    // ridden through half as strewn as the rule says.
    const km = route.length / 1000;
    const mark: Solid = {
      id: "M1",
      kind: "mark",
      x: route.leg.mark.x,
      z: route.leg.mark.z,
      r: route.leg.mark.r,
      top: route.leg.mark.top,
    };
    const solids = laySolids(
      rng,
      biome,
      routeBounds(route),
      offshoreAt,
      geology.groundAt,
      km,
      courseKeepOut(course),
      [mark],
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
      routeBounds(route),
      offshoreAt,
      depthAt,
      solids,
      water.temperature,
      km,
    );
    const level = compileLevel({
      seed,
      biome,
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
    lastReason = analysis.findings
      .filter((f) => f.severity === "error")
      .map((f) => `${f.code}: ${f.message}`)
      .join("; ");
    warn(`level ${seed}: attempt ${attempt} rejected — ${lastReason}`);
  }
  throw new Error(
    `level generation failed for seed ${seed} after ${attempts} attempts: ${lastReason}`,
  );
}
