// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The staged moments (pwa/src/game/scenarios.ts): every named scene stands
// the craft somewhere the level actually has, the scripts are inputs the
// engine accepts, and the ones that promise a moment — a launch through the
// ring, a landing, a dive — deliver it on the steps that follow. Staged on
// the synthetic level (one ramp, one ring) so the generator is not in the
// loop, and once on a generated level for the shore-relative placements.
import { describe, expect, it } from "vitest";

import { TUNING, createGame, sampleField, step, type GameEvent, type GameState } from "@engine";

import {
  SCENARIO_NAMES,
  firstAirGate,
  isScenarioName,
  scenarioFor,
  seawardAt,
  stageScenario,
  type ScenarioName,
} from "../pwa/src/game/scenarios.ts";
import { levelFor } from "./support/levels.ts";
import { syntheticLevel } from "./support/synthetic.ts";

const LEVEL = syntheticLevel({ windSpeed: 3, noSolids: true });

function fresh(): GameState {
  return createGame({ seed: 7, craft: "skiff", level: LEVEL, quiet: true });
}

/** Ride a staged scene for `seconds`, collecting every event. */
function ride(state: GameState, name: ScenarioName, seconds: number): GameEvent[] {
  const scenario = stageScenario(state, name);
  const events: GameEvent[] = [];
  const steps = Math.round(seconds * TUNING.physicsHz);
  for (let i = 0; i < steps; i++) {
    const input = scenario.script(i * TUNING.dt);
    expect(input.throttle).toBeGreaterThanOrEqual(0);
    expect(input.throttle).toBeLessThanOrEqual(1);
    expect(Math.abs(input.steer)).toBeLessThanOrEqual(1);
    expect(Math.abs(input.lean)).toBeLessThanOrEqual(1);
    step(state, input);
    for (const e of state.events) events.push({ ...e });
  }
  return events;
}

describe("the scenario list", () => {
  it("names every scene once and answers the URL's word", () => {
    expect(new Set(SCENARIO_NAMES).size).toBe(SCENARIO_NAMES.length);
    for (const name of SCENARIO_NAMES) expect(isScenarioName(name)).toBe(true);
    expect(isScenarioName("teapot")).toBe(false);
  });

  it("builds every scene inside the level with a finite moment and a positive length", () => {
    const state = fresh();
    for (const name of SCENARIO_NAMES) {
      const s = scenarioFor(state, name);
      expect(Number.isFinite(s.moment.x)).toBe(true);
      expect(Number.isFinite(s.moment.z)).toBe(true);
      expect(Number.isFinite(s.moment.heading)).toBe(true);
      expect(s.seconds).toBeGreaterThan(0);
      const b = LEVEL.bounds;
      expect(s.moment.x).toBeGreaterThanOrEqual(b.minX);
      expect(s.moment.x).toBeLessThanOrEqual(b.maxX);
      expect(s.moment.z).toBeGreaterThanOrEqual(b.minZ);
      expect(s.moment.z).toBeLessThanOrEqual(b.maxZ);
    }
  });
});

describe("staging", () => {
  it("rest is the start, afloat, at rest, with the clock at zero", () => {
    const state = fresh();
    stageScenario(state, "rest");
    expect(state.craft.x).toBeCloseTo(LEVEL.start.x, 9);
    expect(state.craft.z).toBeCloseTo(LEVEL.start.z, 9);
    expect(state.craft.speed).toBe(0);
    expect(state.craft.airborne).toBe(false);
    expect(state.progress.time).toBe(0);
  });

  it("cruise and carve stand the craft under way, and carve turns it", () => {
    const cruise = fresh();
    stageScenario(cruise, "cruise");
    expect(cruise.craft.speed).toBeGreaterThan(5);
    const carve = fresh();
    const heading0 = carve.craft.heading;
    ride(carve, "carve", 2);
    expect(Math.abs(carve.craft.heading - heading0)).toBeGreaterThan(0.2);
    expect(carve.craft.speed).toBeGreaterThan(5);
  });

  it("launch stands the craft on the run-up and puts it through the ring", () => {
    const state = fresh();
    const ring = firstAirGate(LEVEL);
    expect(ring).not.toBeNull();
    const events = ride(state, "launch", 6);
    expect(events.some((e) => e.kind === "launch")).toBe(true);
    expect(events.some((e) => e.kind === "airGate")).toBe(true);
  });

  it("apex is in the air over the ring and comes down on the far side", () => {
    const state = fresh();
    stageScenario(state, "apex");
    expect(state.craft.airborne).toBe(true);
    const ring = firstAirGate(LEVEL)!;
    expect(state.craft.y).toBeGreaterThan(ring.y - 1);
    const events = ride(state, "apex", 3);
    expect(events.some((e) => e.kind === "land")).toBe(true);
  });

  it("landing lands, and dive buries the bow", () => {
    const landing = ride(fresh(), "landing", 3);
    expect(landing.some((e) => e.kind === "land")).toBe(true);
    const dive = ride(fresh(), "dive", 3);
    expect(dive.some((e) => e.kind === "dive")).toBe(true);
  });

  it("capsize goes over on its first steps and the rider rights it", () => {
    const state = fresh();
    const events = ride(state, "capsize", 3);
    expect(state.craft.capsizedFor).toBeGreaterThanOrEqual(0);
    expect(events.some((e) => e.kind === "capsize")).toBe(true);
    // …and is back on its bottom by the end, righted.
    expect(Math.abs(state.craft.roll)).toBeLessThan(0.5);
    expect(state.craft.righting).toBe(0);
  });

  it("backflip leaves the lip rotating, nose up, rider hauled back", () => {
    const state = fresh();
    const s = stageScenario(state, "backflip");
    expect(state.craft.airborne).toBe(true);
    expect(state.craft.wx).toBeLessThan(0);
    expect(s.script(0.5).lean).toBe(1);
    expect(state.craft.pitch).toBeGreaterThan(0.3);
  });

  it("the script stays inside the engine's input ranges for its whole length", () => {
    const state = fresh();
    for (const name of SCENARIO_NAMES) {
      const s = scenarioFor(state, name);
      for (let t = 0; t <= s.seconds; t += 0.1) {
        const i = s.script(t);
        expect(i.throttle).toBeGreaterThanOrEqual(0);
        expect(i.throttle).toBeLessThanOrEqual(1);
        expect(Math.abs(i.steer)).toBeLessThanOrEqual(1);
        expect(Math.abs(i.lean)).toBeLessThanOrEqual(1);
        expect(i.reset).toBe(false);
      }
    }
  });
});

describe("on a generated shore", () => {
  it("seaward points out to sea, and offshore / swell / chop stand the craft on water", () => {
    const level = levelFor(38);
    const state = createGame({ seed: 38, craft: "marlin", level, quiet: true });
    const mid = level.course.gates[Math.floor(level.course.gates.length / 2)];
    const sea = seawardAt(level, mid.x, mid.z);
    expect(Math.hypot(sea.x, sea.z)).toBeCloseTo(1, 6);
    // Twenty metres further out is further from the shore.
    expect(sampleField(level.offshore, mid.x + sea.x * 20, mid.z + sea.z * 20)).toBeGreaterThan(
      sampleField(level.offshore, mid.x, mid.z),
    );
    for (const name of ["offshore", "swell", "chop"] as const) {
      const s = scenarioFor(state, name);
      expect(sampleField(level.ground, s.moment.x, s.moment.z)).toBeLessThan(-1);
      expect(level.materialAt(s.moment.x, s.moment.z)).toBe("water");
    }
  });
});
