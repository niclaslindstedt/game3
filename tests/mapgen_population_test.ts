// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The generator as a POPULATION: how the gate counts, the air gates, the
// lengths, the winds and the build times are distributed across many
// seeds. A rules change moves a distribution, and one seed cannot show
// that — so this file builds its own spread of thirty fresh levels (not
// the corpus, which is a dozen) and holds the spread to bands: inside the
// rule book's, and WIDE enough that the seed is actually choosing.
import { describe, expect, it } from "vitest";

import {
  LEVEL_RULES as R,
  biomeOf,
  daylightWindow,
  generateLevel,
  setOutputSink,
  withinBand,
  type Level,
} from "@engine";

const SEEDS = Array.from({ length: 30 }, (_, i) => i * 53 + 7);

type Sample = { level: Level; ms: number; rerolls: number };

let cache: Sample[] | undefined;

function population(): Sample[] {
  if (cache) return cache;
  const samples: Sample[] = [];
  let rerolls = 0;
  // The generator reports every rejected sub-seed through the output
  // module; counting those is how the reroll rate is read.
  setOutputSink((level) => {
    if (level === "warn") rerolls++;
  });
  try {
    // One throwaway build first: the first level in a process pays for
    // every hot path in the generator being compiled, which is several
    // times what building one costs afterwards, and this file's timing
    // band is about the generator rather than about V8 warming up.
    generateLevel(1);
    for (const seed of SEEDS) {
      rerolls = 0;
      const started = performance.now();
      const level = generateLevel(seed);
      samples.push({ level, ms: performance.now() - started, rerolls });
    }
  } finally {
    setOutputSink(null);
  }
  cache = samples;
  return samples;
}

const spread = (values: number[]): { min: number; max: number; mean: number } => ({
  min: Math.min(...values),
  max: Math.max(...values),
  mean: values.reduce((a, b) => a + b, 0) / values.length,
});

describe("level population", () => {
  it("gate counts follow from the length band and the spacing band", () => {
    const counts = population().map((s) => s.level.course.gates.length);
    const { min, max } = spread(counts);
    // The fewest gates a course can carry is the shortest course at the
    // widest spacing, plus the first gate; the most is the longest at the
    // tightest.
    expect(min).toBeGreaterThanOrEqual(Math.floor(R.course.length.min / R.gate.spacing.max) + 1);
    expect(max).toBeLessThanOrEqual(Math.ceil(R.course.length.max / R.gate.spacing.min) + 1);
    expect(max - min).toBeGreaterThanOrEqual(3);
  });

  it("air gates are two or three, and both counts occur", () => {
    const counts = population().map(
      (s) => s.level.course.gates.filter((g) => g.kind === "air").length,
    );
    for (const c of counts) expect(withinBand(c, R.air.count)).toBe(true);
    expect(counts).toContain(R.air.count.min);
    expect(counts).toContain(R.air.count.max);
  });

  it("lengths fill the band rather than one end of it", () => {
    const lengths = population().map((s) => s.level.course.length);
    for (const l of lengths) expect(withinBand(l, R.course.length)).toBe(true);
    const { min, max } = spread(lengths);
    expect(max - min).toBeGreaterThan((R.course.length.max - R.course.length.min) * 0.5);
  });

  it("winds fill their band and come off the sea", () => {
    const speeds = population().map((s) => s.level.wind.speed);
    for (const v of speeds) expect(withinBand(v, R.wind.speed)).toBe(true);
    const { min, max } = spread(speeds);
    expect(max - min).toBeGreaterThan((R.wind.speed.max - R.wind.speed.min) * 0.5);
  });

  it("hours and water temperatures fill their bands", () => {
    const hours = population().map((s) => s.level.hour);
    const temps = population().map((s) => s.level.water.temperature);
    const daylight = daylightWindow(biomeOf("taiga").latitude, R.day.minSun);
    if (!daylight) throw new Error("the taiga coast has daylight");
    for (const h of hours) expect(withinBand(h, daylight, 0.05)).toBe(true);
    expect(spread(hours).max - spread(hours).min).toBeGreaterThan(6);
    expect(spread(temps).max - spread(temps).min).toBeGreaterThan(4);
    for (const s of population()) expect(s.level.water.density).toBe(1005);
  });

  it("every coast carries rocks of every kind", () => {
    for (const { level } of population()) {
      const kinds = new Set(level.solids.map((s) => s.kind));
      expect(kinds.size).toBe(5);
      expect(level.solids.length).toBeGreaterThan(15);
    }
  });

  it("builds fast, and rarely needs a second coast", () => {
    const times = population().map((s) => s.ms);
    const { max, mean } = spread(times);
    expect(mean).toBeLessThan(400);
    // The worst seed is the one that rerolls its coast most: it builds
    // four or five before one comes up clean, and each of those is a
    // whole shore, course, bake and analysis. The ceiling is that many
    // builds rather than one — under the suite's own type-stripped,
    // unoptimised run, which is two to three times slower than the
    // browser the generator actually runs in.
    expect(max).toBeLessThan(6 * mean);
    const rerolled = population().filter((s) => s.rerolls > 0).length;
    // A third of seeds draw a coast the analysis refuses and try another,
    // and that is the search working rather than struggling: most of those
    // are R21's quilt turning down a shore that runs 800 m as one
    // material. A rule about what a coast has to BE is a rule some coasts
    // fail, and rejecting is how this generator answers that — the cost is
    // one extra build, which the mean above already carries.
    expect(rerolled / SEEDS.length).toBeLessThanOrEqual(0.35);
  });
});
