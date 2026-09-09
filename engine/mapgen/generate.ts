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
import { analyzeLevel } from "../analysis/index.ts";
import { warn } from "../output.ts";
import { biomeOf } from "./biomes.ts";
import { compileLevel, courseBounds, insideBounds } from "./compile.ts";
import { courseKeepOut, layCourse } from "./course.ts";
import { createGeology, laySolids } from "./geology.ts";
import { LEVEL_RULES as R, inBand, type GenerateOptions } from "./rules.ts";
import { createShore } from "./shore.ts";
import { pickWeather, skyCover } from "./weather.ts";
import type { Level } from "./types.ts";

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
  let lastReason = "no attempt made";
  for (let attempt = 0; attempt < attempts; attempt++) {
    const rng = createRng(subSeed(seed, attempt));
    const shore = createShore(rng);
    const geology = createGeology(rng, biome, shore);
    // R12 — off the sea: the seaward normal's compass direction, swung
    // by up to `wind.seaward` either way.
    const seaward = shore.heading + Math.PI / 2;
    const wind = {
      from: (((seaward + rng.range(-R.wind.seaward, R.wind.seaward)) % TAU) + TAU) % TAU,
      speed: inBand(rng, R.wind.speed),
    };
    // R13 — the day and the water.
    const hour = inBand(rng, R.day.hour);
    const water = {
      density: biome.water.density,
      temperature: inBand(rng, biome.water.temperature),
    };
    const course = layCourse(rng, shore, geology);
    if (!course) {
      lastReason = "the coast cannot carry a course";
      warn(`level ${seed}: attempt ${attempt} rejected — ${lastReason}`);
      continue;
    }
    // R17 — the rocks, over the coast the course runs along and a little
    // past it, and only those the level's box actually holds.
    const bounds = courseBounds(course);
    const finishS = shore.toLocal(
      course.path[course.path.length - 1].x,
      course.path[course.path.length - 1].z,
    ).s;
    const solids = laySolids(
      rng,
      biome,
      shore,
      geology,
      -R.bounds.land,
      finishS + R.bounds.sea,
      courseKeepOut(course),
    ).filter((s) => insideBounds(bounds, s.x, s.z));
    // R19 — the sky, drawn LAST. It is the one thing about a level the
    // search never judges: no sky makes a coast unrideable, so a rule about
    // the weather has no business moving the shore, the course or the rocks
    // that the draws before it made. Taking it off the end of the stream is
    // what keeps that true — the geometry a seed produces is the geometry it
    // produced before the sky existed.
    const weather = pickWeather(rng, biome.weathers, skyCover(wind.speed));
    const level = compileLevel({
      seed,
      biome,
      shore,
      geology,
      course,
      solids,
      wind,
      water,
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
