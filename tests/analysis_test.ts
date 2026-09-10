// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The analysis as a JUDGE: it passes the generator's own levels, and it
// catches a level broken by hand — a gate carried inland, a ramp taken
// away, a rock dropped on the line — naming the rule that was broken. The
// second half is the one that matters: a scoreboard that only ever says
// "clean" is measuring nothing, and the generator's reject-and-reroll loop
// is only as honest as the findings it rejects on.
import { describe, expect, it } from "vitest";

import {
  LEVEL_RULES as R,
  analyzeLevel,
  fieldGradient,
  polylineDistance,
  sampleField,
  solidBerth,
  type Gate,
  type Level,
  type Solid,
} from "@engine";

import { LEVEL_SEEDS, analysisFor, levelFor } from "./support/levels.ts";

/** A shallow copy of a corpus level with some part replaced — the corpus
 * is shared and read-only, so breaking one means copying it first. */
function broken(seed: number, patch: Partial<Level>): Level {
  return { ...levelFor(seed), ...patch };
}

function withGates(seed: number, edit: (gates: Gate[]) => Gate[]): Level {
  const level = levelFor(seed);
  return broken(seed, {
    course: { ...level.course, gates: edit(level.course.gates.map((g) => ({ ...g }))) },
  });
}

const codes = (level: Level): string[] => analyzeLevel(level).findings.map((f) => f.code);
const errors = (level: Level): string[] =>
  analyzeLevel(level)
    .findings.filter((f) => f.severity === "error")
    .map((f) => f.code);

/** A point well INLAND of a plan point — where a gate or a station carried
 * there is on dry land, out of R1's band and out of R5's water at once.
 *
 * WALKED down the offshore field's own gradient rather than stepped once
 * along it: a basin has no "shore's left" to walk (R15), and one step in
 * the direction the field falls at a point can come out further from the
 * water than it started when the water it was measuring is a bend of a
 * channel. This follows the field until it is actually on land. */
function inlandFrom(level: Level, x: number, z: number): { x: number; z: number } {
  let at = { x, z };
  for (let step = 0; step < 60; step++) {
    if (sampleField(level.offshore, at.x, at.z) < -20) break;
    const g = fieldGradient(level.offshore, at.x, at.z);
    const len = Math.hypot(g.gx, g.gz);
    if (len < 1e-6) break;
    at = { x: at.x - (g.gx / len) * 8, z: at.z - (g.gz / len) * 8 };
  }
  return at;
}

describe("level analysis", () => {
  it("passes every level the generator ships, with the stats filled in", () => {
    for (const seed of LEVEL_SEEDS) {
      const a = analysisFor(seed);
      expect(a.ok).toBe(true);
      expect(a.seed).toBe(seed);
      expect(a.stats.gates).toBe(levelFor(seed).course.gates.length);
      expect(a.stats.airGates).toBeGreaterThanOrEqual(R.air.count.min);
      expect(a.stats.minDepth).toBeGreaterThanOrEqual(R.course.minDepth);
      expect(a.stats.minClearance).toBeGreaterThanOrEqual(R.course.solidMargin);
      // …and the biggest rock on it keeps the berth its own size earns.
      for (const s of levelFor(seed).solids) {
        expect(polylineDistance(levelFor(seed).course.path, s.x, s.z) - s.r).toBeGreaterThanOrEqual(
          solidBerth(s.r),
        );
      }
      expect(a.stats.length).toBe(levelFor(seed).course.length);
      expect(a.ms).toBeLessThan(1000);
    }
  });

  it("R1 — flags a gate carried inland", () => {
    const seed = LEVEL_SEEDS[0];
    const level = withGates(seed, (gates) => {
      const g = gates[3];
      // Carried inland until it is on dry land — well out of R1's band.
      gates[3] = { ...g, ...inlandFrom(levelFor(seed), g.x, g.z) };
      return gates;
    });
    const a = analyzeLevel(level);
    expect(a.ok).toBe(false);
    const gate = a.findings.find((f) => f.code === "R1.gate");
    expect(gate).toBeDefined();
    expect(gate!.message).toContain("G4");
    expect(gate!.at).toBeDefined();
  });

  it("R1/R5 — flags a path that leaves the band", () => {
    const seed = LEVEL_SEEDS[1];
    const level = levelFor(seed);
    const path = level.course.path.map((p) => ({ ...p }));
    const mid = Math.floor(path.length / 2);
    // Inland, so the point is out of R1's band on the FLOOR and out of the
    // water R5 asks for at the same time. Seaward would break neither on
    // its own: out past R1's ceiling is where R25's ocean leg goes, and the
    // analysis reads the longest such stretch as the leg.
    path[mid] = inlandFrom(level, path[mid].x, path[mid].z);
    const found = errors(broken(seed, { course: { ...level.course, path } }));
    expect(found).toContain("R1.path");
    expect(found).toContain("R5.path");
  });

  it("R8 — flags an air gate whose ramp was taken away", () => {
    const seed = LEVEL_SEEDS[2];
    const level = withGates(seed, (gates) => {
      const i = gates.findIndex((g) => g.kind === "air");
      gates[i] = { ...gates[i], ramp: undefined };
      return gates;
    });
    expect(errors(level)).toContain("R8.missing");
  });

  it("R8 — flags a ramp turned off its ring's axis", () => {
    const seed = LEVEL_SEEDS[3];
    const level = withGates(seed, (gates) => {
      const i = gates.findIndex((g) => g.kind === "air");
      const g = gates[i];
      gates[i] = { ...g, ramp: { ...g.ramp!, heading: g.ramp!.heading + 0.3 } };
      return gates;
    });
    const found = errors(level);
    expect(found).toContain("R8.aligned");
    expect(found).toContain("R8.axis");
  });

  it("R18 — flags a ring carried out of the slowest craft's reach", () => {
    const seed = LEVEL_SEEDS[2];
    const level = withGates(seed, (gates) => {
      const i = gates.findIndex((g) => g.kind === "air");
      const g = gates[i];
      // Twice as far from the hinge along the axis, at the same height:
      // an arc only a much faster hull draws.
      const fx = Math.sin(g.heading);
      const fz = Math.cos(g.heading);
      const lead = Math.hypot(g.x - g.ramp!.x, g.z - g.ramp!.z);
      gates[i] = { ...g, x: g.ramp!.x + fx * lead * 2, z: g.ramp!.z + fz * lead * 2 };
      return gates;
    });
    const found = errors(level);
    expect(found).toContain("R18.arc");
    expect(found.some((c) => c === "R18.reach" || c === "R18.design")).toBe(true);
  });

  it("R6 — flags a rock dropped on the line", () => {
    const seed = LEVEL_SEEDS[4];
    const level = levelFor(seed);
    const p = level.course.path[Math.floor(level.course.path.length / 2)];
    const rock: Solid = { id: "B999", kind: "boulder", x: p.x, z: p.z, r: 1.5, top: 0.5 };
    const found = errors(broken(seed, { solids: [...level.solids, rock] }));
    expect(found).toContain("R6.clear");
  });

  it("R9 — flags a rock in a run-up, even one clear of the path itself", () => {
    const seed = LEVEL_SEEDS[5];
    const level = levelFor(seed);
    const air = level.course.gates.find((g) => g.kind === "air")!;
    const ramp = air.ramp!;
    // Beside the run-up: past R6's margin from the line, inside the
    // corridor's half-width plus the rock's radius.
    const rx = Math.cos(ramp.heading);
    const rz = -Math.sin(ramp.heading);
    const fx = Math.sin(ramp.heading);
    const fz = Math.cos(ramp.heading);
    const side = R.course.solidMargin + 0.5 + 1;
    const rock: Solid = {
      id: "F999",
      kind: "reef",
      x: ramp.x - fx * 30 + rx * side,
      z: ramp.z - fz * 30 + rz * side,
      r: 2.5,
      top: -0.5,
    };
    const found = errors(broken(seed, { solids: [...level.solids, rock] }));
    expect(found).toContain("R9.clear");
  });

  it("R4 — flags a water gate lifted off the water and a gate moved along the path", () => {
    const seed = LEVEL_SEEDS[6];
    const lifted = withGates(seed, (gates) => {
      // A WATER gate lifted off the water: which index that is moves with
      // the generator, so it is found rather than counted to.
      const i = gates.findIndex((g) => g.kind === "water" && g.index > 0);
      gates[i] = { ...gates[i], y: 2 };
      return gates;
    });
    expect(errors(lifted)).toContain("R4.afloat");
    const crowded = withGates(seed, (gates) => {
      const a = gates[1];
      const b = gates[2];
      // Gate 3 dragged back on top of gate 2's neighbourhood.
      gates[2] = { ...b, x: (a.x * 3 + b.x) / 4, z: (a.z * 3 + b.z) / 4 };
      return gates;
    });
    expect(errors(crowded)).toContain("R4.spacing");
  });

  it("R7 — flags an air gate made the finish, and a ring floated too high", () => {
    const seed = LEVEL_SEEDS[7];
    const finish = withGates(seed, (gates) => {
      const last = gates.length - 1;
      const donor = gates.find((g) => g.kind === "air")!;
      gates[last] = {
        ...gates[last],
        kind: "air",
        y: 4,
        width: R.air.width,
        ramp: { ...donor.ramp! },
      };
      return gates;
    });
    expect(errors(finish)).toContain("R7.finish");
    const high = withGates(seed, (gates) => {
      const i = gates.findIndex((g) => g.kind === "air");
      gates[i] = { ...gates[i], y: R.air.height.max + 3 };
      return gates;
    });
    expect(errors(high)).toContain("R7.height");
  });

  it("R10, R11 — flags a falsified length and a start that does not face its gate", () => {
    const seed = LEVEL_SEEDS[8];
    expect(errors(broken(seed, { course: { ...levelFor(seed).course, length: 3000 } }))).toContain(
      "R10.length",
    );
    const start = levelFor(seed).start;
    expect(errors(broken(seed, { start: { ...start, heading: start.heading + 1 } }))).toContain(
      "R11.facing",
    );
  });

  it("R12, R13, R19 — flags a gale, a landward wind, an hour off the clock, the wrong water and an unoffered sky", () => {
    const seed = LEVEL_SEEDS[9];
    const level = levelFor(seed);
    expect(errors(broken(seed, { wind: { ...level.wind, speed: 20 } }))).toContain("R12.speed");
    expect(
      errors(broken(seed, { wind: { ...level.wind, from: level.wind.from + Math.PI } })),
    ).toContain("R12.direction");
    // Any hour on the clock is legal (R13's band is the whole day), so what
    // is left to flag is an hour that is not one — a level whose sun cannot
    // be placed at all.
    expect(errors(broken(seed, { hour: 26 }))).toContain("R13.hour");
    expect(errors(broken(seed, { water: { density: 1025, temperature: 25 } }))).toEqual(
      expect.arrayContaining(["R13.density", "R13.temperature"]),
    );
    expect(errors(broken(seed, { weather: "fjord-fog" as Level["weather"] }))).toContain(
      "R19.weather",
    );
  });

  it("R17 — flags a reef sunk under the bed and two rocks on top of each other", () => {
    const seed = LEVEL_SEEDS[10];
    const level = levelFor(seed);
    const reef = level.solids.find((s) => s.kind === "reef")!;
    const sunk: Solid = { ...reef, id: "F998", x: reef.x + 30, z: reef.z + 30, top: -40 };
    const found = errors(broken(seed, { solids: [...level.solids, sunk] }));
    expect(found).toContain("R17.top");
    expect(found).toContain("R17.proud");
    const twin: Solid = { ...reef, id: "F997" };
    expect(errors(broken(seed, { solids: [...level.solids, twin] }))).toContain("R17.spacing");
  });

  it("names the rule and a stable code on every finding", () => {
    const seed = LEVEL_SEEDS[11];
    const level = broken(seed, { hour: -1, wind: { ...levelFor(seed).wind, speed: 0 } });
    for (const f of analyzeLevel(level).findings) {
      expect(f.rule).toMatch(/^R\d+$/);
      expect(f.code.startsWith(`${f.rule}.`)).toBe(true);
      expect(f.message.length).toBeGreaterThan(0);
    }
    expect(codes(level)).toEqual(expect.arrayContaining(["R13.hour", "R12.speed"]));
  });
});
