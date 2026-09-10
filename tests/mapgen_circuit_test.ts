// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R29, R30, R31 — THE OCEAN CIRCUIT, over a spread of seeds.
//
// Two halves, and the second is the one that matters. The first asserts
// that every circuit the generator ships holds the rule book's second
// chapter: the line stands out at sea, the ride is whole laps of one lap,
// and every lap goes round rocks. The second breaks a circuit by hand and
// asserts that the analysis SAYS SO — a scoreboard that only ever prints
// "clean" is measuring nothing, and the generator rejects on this one.
//
// A circuit is also still a level, so the rules that are about water and
// rock rather than about a coast (R5's depth under the line, R6's berth,
// R7's air, R14's grid, R17's rocks) are asserted here too: those checks
// are shared code, but nothing else runs them over a level with no river,
// no corridor and a shore four hundred metres away.
import { describe, expect, it } from "vitest";

import {
  LEVEL_RULES as R,
  analyzeLevel,
  generateLevel,
  lapTurn,
  polylineDistance,
  roundingAbout,
  sampleField,
  solidBerth,
  withinBand,
  type Level,
} from "@engine";

import { CIRCUIT_SEEDS, circuitAnalysisFor, circuitFor } from "./support/levels.ts";

const C = R.circuit;

/** A shallow copy of a corpus circuit with some part replaced — the corpus
 * is shared and read-only, so breaking one means copying it first. */
function broken(seed: number, patch: Partial<Level>): Level {
  return { ...circuitFor(seed), ...patch };
}

const errors = (level: Level): string[] =>
  analyzeLevel(level)
    .findings.filter((f) => f.severity === "error")
    .map((f) => f.code);

describe("R29 — the circuit is drawn out at sea", () => {
  it("is a pure function of its seed", () => {
    const a = generateLevel(CIRCUIT_SEEDS[0], { track: "circuit" });
    const b = generateLevel(CIRCUIT_SEEDS[0], { track: "circuit" });
    expect(a.course.gates.map((g) => `${g.id}:${g.x.toFixed(6)}:${g.z.toFixed(6)}`)).toEqual(
      b.course.gates.map((g) => `${g.id}:${g.x.toFixed(6)}:${g.z.toFixed(6)}`),
    );
    expect(a.solids.map((s) => s.id)).toEqual(b.solids.map((s) => s.id));
  });

  it("says which chapter it was built to", () => {
    for (const seed of CIRCUIT_SEEDS) expect(circuitFor(seed).track).toBe("circuit");
    // …and a coast level is not quietly one.
    expect(generateLevel(1).track).toBe("coast");
  });

  it("keeps every metre of the line off the shore", () => {
    for (const seed of CIRCUIT_SEEDS) {
      const level = circuitFor(seed);
      for (const p of level.course.path) {
        const off = sampleField(level.offshore, p.x, p.z);
        expect(off, `seed ${seed} at ${p.x.toFixed(0)},${p.z.toFixed(0)}`).toBeGreaterThan(
          C.offshore.min - R.grid.cell,
        );
      }
    }
  });

  it("carries no river and no current", () => {
    for (const seed of CIRCUIT_SEEDS) {
      const level = circuitFor(seed);
      expect(level.river, `seed ${seed}`).toHaveLength(0);
      // One cell of standing water is what `flowAt` reads anywhere outside
      // a real flow field; a circuit's whole plan is outside one.
      expect(level.flow.vx.data.every((v) => v === 0)).toBe(true);
      expect(level.flow.vz.data.every((v) => v === 0)).toBe(true);
    }
  });

  it("closes: the ride ends where a lap begins", () => {
    for (const seed of CIRCUIT_SEEDS) {
      const path = circuitFor(seed).course.path;
      const seam = Math.hypot(
        path[path.length - 1].x - path[0].x,
        path[path.length - 1].z - path[0].z,
      );
      // The path starts at the start (R11), a setback behind the line, and
      // ends ON the line.
      expect(seam, `seed ${seed}`).toBeCloseTo(R.start.behind, 1);
    }
  });

  it("turns further than a circle does", () => {
    for (const seed of CIRCUIT_SEEDS) {
      const level = circuitFor(seed);
      const perLap = lapTurn(level.course.path) / level.course.laps;
      expect(withinBand(perLap, C.turn, 0.3), `seed ${seed}: ${perLap.toFixed(2)} rad`).toBe(true);
      expect(perLap, `seed ${seed} is a ring road`).toBeGreaterThan(Math.PI * 2);
    }
  });
});

describe("R30 — the circuit is lapped", () => {
  it("rides whole laps of one lap", () => {
    for (const seed of CIRCUIT_SEEDS) {
      const { course } = circuitFor(seed);
      expect(withinBand(course.laps, C.laps), `seed ${seed}`).toBe(true);
      expect(course.gates).toHaveLength(course.laps * course.lapGates + 1);
      expect(withinBand(course.length, C.length), `seed ${seed}`).toBe(true);
    }
  });

  it("puts every lap's gates in the same water", () => {
    for (const seed of CIRCUIT_SEEDS) {
      const { gates, lapGates } = circuitFor(seed).course;
      for (let i = 0; i + lapGates < gates.length; i++) {
        const a = gates[i];
        const b = gates[i + lapGates];
        expect(Math.hypot(a.x - b.x, a.z - b.z), `seed ${seed}: ${a.id} vs ${b.id}`).toBeLessThan(
          0.5,
        );
        expect(b.kind).toBe(a.kind);
      }
    }
  });

  it("finishes on the start line, and starts behind it", () => {
    for (const seed of CIRCUIT_SEEDS) {
      const level = circuitFor(seed);
      const gates = level.course.gates;
      const finish = gates[gates.length - 1];
      expect(Math.hypot(finish.x - gates[0].x, finish.z - gates[0].z), `seed ${seed}`).toBeLessThan(
        0.5,
      );
      expect(finish.kind, `seed ${seed}: the finish flies`).toBe("water");
      expect(gates[0].kind).toBe("water");
      expect(
        Math.hypot(gates[0].x - level.start.x, gates[0].z - level.start.z),
        `seed ${seed}`,
      ).toBeCloseTo(R.start.behind, 1);
    }
  });

  it("spaces the gates evenly, round the seam as well as inside a lap", () => {
    for (const seed of CIRCUIT_SEEDS) {
      const { gates, lapGates, length } = circuitFor(seed).course;
      const lap = (length - R.start.behind) / circuitFor(seed).course.laps;
      const spacing = lap / lapGates;
      expect(withinBand(spacing, R.gate.spacing), `seed ${seed}: ${spacing.toFixed(1)} m`).toBe(
        true,
      );
      expect(gates.length).toBeGreaterThan(lapGates);
    }
  });

  it("carries R7's air over the whole ride, one ramp a lap", () => {
    for (const seed of CIRCUIT_SEEDS) {
      const { gates, lapGates, laps } = circuitFor(seed).course;
      const air = gates.filter((g) => g.kind === "air");
      expect(withinBand(air.length, R.air.count), `seed ${seed}: ${air.length} air gates`).toBe(
        true,
      );
      expect(gates.slice(0, lapGates).filter((g) => g.kind === "air")).toHaveLength(C.airPerLap);
      expect(air.length).toBe(C.airPerLap * laps);
    }
  });
});

describe("R31 — every lap goes round something", () => {
  it("stands marks in the bends, and the line rounds them", () => {
    for (const seed of CIRCUIT_SEEDS) {
      const level = circuitFor(seed);
      const marks = level.solids.filter((s) => s.kind === "mark");
      expect(withinBand(marks.length, C.mark.count), `seed ${seed}: ${marks.length}`).toBe(true);
      for (const mark of marks) {
        const round = roundingAbout(level.course.path, mark, C.mark.near);
        expect(
          withinBand(round.stand, C.mark.stand, 3),
          `seed ${seed}: ${mark.id} stands ${round.stand.toFixed(0)} m off`,
        ).toBe(true);
        expect(
          round.sweep,
          `seed ${seed}: ${mark.id} is passed, not rounded`,
        ).toBeGreaterThanOrEqual(C.mark.wrap - 0.15);
      }
    }
  });

  it("gives every rock R6's berth from the line", () => {
    for (const seed of CIRCUIT_SEEDS) {
      const level = circuitFor(seed);
      for (const s of level.solids) {
        const clear = polylineDistance(level.course.path, s.x, s.z) - s.r;
        expect(clear, `seed ${seed}: ${s.id} (${s.kind})`).toBeGreaterThanOrEqual(solidBerth(s.r));
      }
    }
  });

  it("strews the open-water rocks out where the race is", () => {
    // R29's own band for the kinds that stand in open water: without it a
    // circuit's sea is bare, because every coastal band tops out inshore of
    // the line.
    for (const seed of CIRCUIT_SEEDS) {
      const level = circuitFor(seed);
      const open = level.solids.filter((s) => s.kind !== "boulder" && s.kind !== "erratic");
      expect(open.length, `seed ${seed}`).toBeGreaterThan(0);
    }
  });
});

/** The emptiest water a lap encloses: the plan point furthest from the line
 * anywhere inside the loop, found by scanning the path's own box. A mark
 * carried here is still wound a full turn every lap and is still nowhere
 * near the racing line, which is exactly the fault R31's range checks are
 * for. */
function infield(level: Level): { x: number; z: number } {
  const path = level.course.path;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of path) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  let best = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
  let far = -Infinity;
  for (let i = 1; i < 40; i++) {
    for (let j = 1; j < 40; j++) {
      const x = minX + ((maxX - minX) * i) / 40;
      const z = minZ + ((maxZ - minZ) * j) / 40;
      if (Math.abs(roundingAbout(path, { x, z }, 1).winding) < Math.PI * 2 - 0.5) continue;
      const d = polylineDistance(path, x, z);
      if (d > far) {
        far = d;
        best = { x, z };
      }
    }
  }
  return best;
}

describe("the analysis judges a circuit", () => {
  const seed = CIRCUIT_SEEDS[0];

  it("passes every circuit the generator ships", () => {
    for (const s of CIRCUIT_SEEDS) {
      const report = circuitAnalysisFor(s);
      expect(
        report.findings.filter((f) => f.severity === "error"),
        `seed ${s}`,
      ).toHaveLength(0);
      expect(report.ok).toBe(true);
    }
  });

  it("catches a lap count that does not match the gates (R30)", () => {
    const level = circuitFor(seed);
    expect(
      errors(broken(seed, { course: { ...level.course, laps: level.course.laps + 1 } })),
    ).toContain("R30.gates");
  });

  it("catches a ride cut short of its band (R30)", () => {
    const level = circuitFor(seed);
    expect(errors(broken(seed, { course: { ...level.course, length: 400 } }))).toContain(
      "R30.length",
    );
  });

  it("catches a mark carried out of the bend it stood in (R31)", () => {
    const level = circuitFor(seed);
    const mark = level.solids.find((s) => s.kind === "mark");
    expect(mark).toBeDefined();
    if (!mark) return;
    // Out to the emptiest water the lap encloses — the point furthest from
    // the line anywhere inside it. The winding about it is still a full
    // turn, so nothing but the two checks about RANGE can catch it, which
    // is the pair R31 exists for: a rock on the infield is not a rounding.
    const moved = level.solids.map((s) => (s === mark ? { ...s, ...infield(level) } : s));
    expect(errors(broken(seed, { solids: moved }))).toContain("R31.stand");
  });

  it("catches a mark thrown outside the lap (R31)", () => {
    const level = circuitFor(seed);
    const mark = level.solids.find((s) => s.kind === "mark");
    if (!mark) return;
    const away = level.solids.map((s) =>
      s === mark ? { ...s, x: level.bounds.minX + 8, z: level.bounds.minZ + 8 } : s,
    );
    expect(errors(broken(seed, { solids: away }))).toContain("R31.outside");
  });

  it("catches a circuit with no marks at all (R31)", () => {
    const level = circuitFor(seed);
    const bare = level.solids.filter((s) => s.kind !== "mark");
    expect(errors(broken(seed, { solids: bare }))).toContain("R31.count");
  });

  it("catches a line carried in toward the shore (R29)", () => {
    const level = circuitFor(seed);
    // The whole path walked half its own clearance toward the land: the
    // fault a basin cut in the wrong place would ship.
    const inland = level.course.path.map((p) => ({
      x: p.x - Math.sin(level.wind.from) * -C.offshore.min * 0.9,
      z: p.z - Math.cos(level.wind.from) * -C.offshore.min * 0.9,
    }));
    const found = errors(broken(seed, { course: { ...level.course, path: inland } }));
    expect(found.length, "a line dragged ashore is reported").toBeGreaterThan(0);
  });
});
