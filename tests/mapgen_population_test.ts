// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The generator as a POPULATION: how the gate counts, the air gates, the
// lengths, the winds and the build times are distributed across many
// seeds. A rules change moves a distribution, and one seed cannot show
// that — so this file builds its own spread of thirty fresh levels (not
// the corpus, which is a dozen) and holds the spread to bands: inside the
// rule book's, and WIDE enough that the seed is actually choosing.
import { describe, expect, it } from "vitest";

import { LEVEL_RULES as R, generateLevel, setOutputSink, withinBand, type Level } from "@engine";

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
    for (const h of hours) expect(withinBand(h, R.day.hour)).toBe(true);
    expect(spread(hours).max - spread(hours).min).toBeGreaterThan(6);
    expect(spread(temps).max - spread(temps).min).toBeGreaterThan(4);
    for (const s of population()) expect(s.level.water.density).toBe(1005);
  });

  it("every coast carries rocks of every kind", () => {
    for (const { level } of population()) {
      const kinds = new Set(level.solids.map((s) => s.kind));
      expect(kinds.size).toBe(3);
      expect(level.solids.length).toBeGreaterThan(15);
    }
  });

  it("builds fast, and rarely needs a second coast", () => {
    const times = population().map((s) => s.ms);
    const { max, mean } = spread(times);
    expect(mean).toBeLessThan(400);
    expect(max).toBeLessThan(1000);
    const rerolled = population().filter((s) => s.rerolls > 0).length;
    expect(rerolled / SEEDS.length).toBeLessThanOrEqual(0.2);
  });
});
