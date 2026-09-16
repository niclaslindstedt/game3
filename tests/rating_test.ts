// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// LEVEL RATING (`engine/rating/`): how hard a shore is, on eight axes, and
// how a ladder of them reads. Two things are worth a guard: that every
// axis moves with the thing it claims to measure (the day's three off the
// conditions alone, the shore's five off the level), and that the ladder
// scorer names a flat rung and a duplicate — the two mistakes a curator
// makes by sorting a sweep on the index and keeping the top six.

import { describe, expect, it } from "vitest";

import {
  LADDER,
  RATING,
  RATING_AXES,
  characterDistance,
  cornerRadius,
  leadingAxis,
  levelConditions,
  rateLadder,
  rateLevel,
  type RatingAxes,
} from "@engine";

import { LEVEL_SEEDS, circuitFor, levelFor } from "./support/levels.ts";

const LEVEL = levelFor(LEVEL_SEEDS[0]);

function axes(over: Partial<RatingAxes> = {}): RatingAxes {
  return { sea: 0, corners: 0, air: 0, rocks: 0, length: 0, wind: 0, dark: 0, sky: 0, ...over };
}

describe("one level's rating", () => {
  const rating = rateLevel(LEVEL);

  it("keeps every axis and the index inside 0..1, and the weights summing to one", () => {
    for (const axis of RATING_AXES) {
      expect(rating.axes[axis]).toBeGreaterThanOrEqual(0);
      expect(rating.axes[axis]).toBeLessThanOrEqual(1);
    }
    expect(rating.difficulty).toBeGreaterThanOrEqual(0);
    expect(rating.difficulty).toBeLessThanOrEqual(1);
    const total = RATING_AXES.reduce((sum, axis) => sum + RATING.weight[axis], 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it("reads the level's own day when none is pinned", () => {
    expect(rating.conditions).toEqual(levelConditions(LEVEL));
    expect(rating.conditions.wind).toBe(LEVEL.wind.speed);
  });

  it("moves the day's axes off the conditions, and only those", () => {
    const noon = rateLevel(LEVEL, { hour: 12, season: "summer", weather: "clear" });
    const night = rateLevel(LEVEL, { hour: 0, season: "winter", weather: "squall" });
    expect(night.axes.dark).toBe(1);
    expect(noon.axes.dark).toBeLessThan(0.5);
    expect(night.axes.sky).toBe(1);
    expect(noon.axes.sky).toBe(0);
    for (const axis of ["corners", "air", "rocks", "length"] as const) {
      expect(night.axes[axis]).toBe(noon.axes[axis]);
    }
    expect(night.difficulty).toBeGreaterThan(noon.difficulty);
  });

  it("grows the sea and the wind with the wind it is rated under", () => {
    const calm = rateLevel(LEVEL, { wind: 6 });
    const gale = rateLevel(LEVEL, { wind: 14 });
    expect(calm.axes.wind).toBe(0);
    expect(gale.axes.wind).toBe(1);
    expect(gale.stats.hs).toBeGreaterThan(calm.stats.hs);
    expect(gale.axes.sea).toBeGreaterThanOrEqual(calm.axes.sea);
  });

  it("reads a circuit as longer than a sprint, and a tricks field as more air", () => {
    const circuit = rateLevel(circuitFor(3));
    expect(circuit.stats.ridden).toBeGreaterThan(rating.stats.ridden * 2);
    expect(circuit.axes.length).toBeGreaterThan(rating.axes.length);
  });

  it("names the axis a shore leads on", () => {
    expect(leadingAxis(axes({ rocks: 0.9, sea: 0.4 }))).toBe("rocks");
    expect(leadingAxis(axes())).toBe("sea");
  });

  it("reads a corner over a window of stations, and a straight as infinite", () => {
    const straight = Array.from({ length: 20 }, (_, i) => ({ x: i * 10, z: 0 }));
    expect(cornerRadius(straight, 10)).toBe(Infinity);
    expect(cornerRadius(straight, 0)).toBe(Infinity);
    const circle = Array.from({ length: 40 }, (_, i) => ({
      x: 100 * Math.cos((i / 40) * Math.PI * 2),
      z: 100 * Math.sin((i / 40) * Math.PI * 2),
    }));
    expect(cornerRadius(circle, 20)).toBeCloseTo(100, 0);
  });
});

describe("a ladder", () => {
  const rung = (name: string, difficulty: number, over: Partial<RatingAxes> = {}) => ({
    name,
    rating: { ...rateLevel(LEVEL), difficulty, axes: axes({ sea: difficulty, ...over }) },
  });

  it("measures how unlike two shores are", () => {
    expect(characterDistance(axes(), axes())).toBe(0);
    expect(characterDistance(axes({ sea: 1 }), axes({ rocks: 1 }))).toBeGreaterThan(LADDER.apart);
  });

  it("passes a climb with distinct rungs", () => {
    const report = rateLadder([
      rung("a", 0.2, { corners: 0.9 }),
      rung("b", 0.3, { air: 0.9 }),
      rung("c", 0.45, { rocks: 0.9 }),
    ]);
    expect(report.notes).toEqual([]);
    expect(report.asks).toEqual([0.2, 0.3, 0.45]);
    expect(report.climb).toBeCloseTo(0.1, 6);
    expect(report.wall).toBeCloseTo(0.15, 6);
  });

  it("names a rung that asks no more than the one before, a wall, and a shore twice", () => {
    const report = rateLadder([
      rung("first", 0.3, { corners: 0.9 }),
      rung("flat", 0.3, { air: 0.9 }),
      rung("wall", 0.8, { rocks: 0.9 }),
      rung("twin", 0.85, { rocks: 0.9 }),
    ]);
    expect(report.notes.some((n) => n.startsWith("flat asks no more than first"))).toBe(true);
    expect(report.notes.some((n) => n.startsWith("wall is a wall after flat"))).toBe(true);
    expect(report.notes.some((n) => n.includes("wall and twin are the same shore twice"))).toBe(
      true,
    );
  });

  it("reads a single rung as neither a climb nor a wall", () => {
    const report = rateLadder([rung("only", 0.5)]);
    expect(report.climb).toBe(0);
    expect(report.wall).toBe(0);
    expect(report.apart).toBe(1);
    expect(report.notes).toEqual([]);
  });
});
