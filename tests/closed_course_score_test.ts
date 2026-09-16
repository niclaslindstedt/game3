// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CLOSED-COURSE SCORE: generated circuits clear the project's 90-point
// quality floor, the score remains deterministic, and a course stripped of
// the IJSBA start/lap/marker structure loses enough points to be rejected.
import { describe, expect, it } from "vitest";

import { CLOSED_COURSE_FLOOR, analyzeLevel, type Level } from "@engine";

import { CIRCUIT_SEEDS, circuitAnalysisFor, circuitFor } from "./support/levels.ts";

describe("IJSBA closed-course score", () => {
  it("keeps every generated circuit in the 90–100 target band", () => {
    for (const seed of CIRCUIT_SEEDS) {
      const analysis = circuitAnalysisFor(seed);
      const score = analysis.closedCourse;
      expect(score, `seed ${seed}`).toBeDefined();
      expect(score!.score, `seed ${seed}`).toBeGreaterThanOrEqual(CLOSED_COURSE_FLOOR);
      expect(score!.score, `seed ${seed}`).toBeLessThanOrEqual(100);
      expect(score!.metrics.map((metric) => metric.id)).toEqual([
        "format",
        "turns",
        "markers",
        "start",
        "safety",
      ]);
      for (const metric of score!.metrics) {
        expect(metric.score, `${seed}: ${metric.id}`).toBeGreaterThanOrEqual(0);
        expect(metric.score, `${seed}: ${metric.id}`).toBeLessThanOrEqual(1);
        expect(metric.checks.length, `${seed}: ${metric.id}`).toBeGreaterThan(0);
        for (const check of metric.checks) {
          expect(check.source, `${seed}: ${metric.id}.${check.id}`).not.toBe("");
          expect(check.target, `${seed}: ${metric.id}.${check.id}`).not.toBe("");
        }
      }
    }
  });

  it("is a pure reading of the compiled level", () => {
    const level = circuitFor(CIRCUIT_SEEDS[0]);
    expect(analyzeLevel(level).closedCourse).toEqual(analyzeLevel(level).closedCourse);
  });

  it("rejects a circuit with no lapped start or rounding markers", () => {
    const level = circuitFor(CIRCUIT_SEEDS[1]);
    const broken: Level = {
      ...level,
      start: { ...level.start, heading: level.start.heading + Math.PI },
      solids: level.solids.filter((solid) => solid.kind !== "buoy"),
      course: { ...level.course, laps: 1, length: 1000 },
    };
    const analysis = analyzeLevel(broken);
    expect(analysis.closedCourse!.score).toBeLessThan(CLOSED_COURSE_FLOOR);
    expect(analysis.findings.map((finding) => finding.code)).toContain("IJSBA.score");
    expect(analysis.ok).toBe(false);
  });
});
