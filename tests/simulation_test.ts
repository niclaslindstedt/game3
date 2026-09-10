// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The simulation slice: the bot rides levels end to end through the real
// engine, deterministically, and nothing the sea throws at the hull makes
// a number that is not a number. The synthetic level is the §23.8 fixture;
// the generated seeds are the generator and the handling kept honest with
// each other.
import { describe, expect, it } from "vitest";

import {
  CRAFT,
  TUNING,
  createGame,
  generateLevel,
  SIM_SECONDS,
  simulateStage,
  step,
  type CraftInput,
} from "@engine";

import { syntheticLevel } from "./support/synthetic.ts";

function finite(state: ReturnType<typeof createGame>): boolean {
  const c = state.craft;
  const values = [
    c.x,
    c.y,
    c.z,
    c.vx,
    c.vy,
    c.vz,
    c.wx,
    c.wy,
    c.wz,
    c.q.x,
    c.q.y,
    c.q.z,
    c.q.w,
    c.rpm,
    c.pitch,
    c.roll,
  ];
  return values.every((v) => Number.isFinite(v));
}

describe("the bot on the synthetic shore", () => {
  for (const spec of CRAFT) {
    it(`${spec.id} finishes the course and takes the ramp`, () => {
      const report = simulateStage({
        seed: 2,
        craft: spec.id,
        level: syntheticLevel({ windSpeed: 3 }),
        maxSeconds: 120,
      });
      expect(
        report.finished,
        `${spec.id}: ${report.gatesPassed}/${report.gates} in ${report.time.toFixed(1)} s`,
      ).toBe(true);
      // The ring is placed for the pace the shore's straights allow; a
      // hull that brings a different pace to the lip may sail over or
      // under it, pay for it, and ride on — never loop back.
      expect(report.gatesPassed + report.gatesMissed).toBe(report.gates);
      expect(report.gatesMissed).toBeLessThanOrEqual(1);
      expect(report.resets).toBe(0);
      expect(report.hits).toBe(0);
      expect(report.launches).toBeGreaterThanOrEqual(1);
      expect(report.topSpeed * 3.6).toBeGreaterThan(spec.topSpeed * 0.6);
      expect(report.topSpeed * 3.6).toBeLessThan(spec.topSpeed * 1.15);
      // 630 m of course at pace: well under a minute.
      expect(report.time).toBeLessThan(60);
      expect(report.time).toBeGreaterThan(20);
      expect(report.maxHs).toBeGreaterThan(0);
      expect(report.digest).toMatch(/^[0-9a-f]{8}$/);
    });
  }

  it("rides the skerries' level without hitting them, and threads the ring", () => {
    const report = simulateStage({
      seed: 3,
      craft: "skiff",
      level: syntheticLevel({ windSpeed: 5 }),
      maxSeconds: 120,
    });
    expect(report.finished).toBe(true);
    expect(report.hits).toBe(0);
    // The rocks and the ring are what this case is about. A buoy is not:
    // under this shore's 0.8 m beam sea the bot weaves several metres
    // either side of the line at 80 km/h, and on some seeds that puts it
    // a metre outside a buoy, which the engine charges and the rider
    // carries on from (`course.missWide`) rather than looping back for.
    expect(report.gatesMissed).toBeLessThanOrEqual(1);
    expect(report.events.some((e) => e.kind === "airGate")).toBe(true);
  });
});

describe("nothing explodes", () => {
  it("survives 60 s of 4 m/s chop offshore at full throttle with a weave", () => {
    const level = syntheticLevel({ windSpeed: 4, noSolids: true, seaward: 800 });
    const state = createGame({ seed: 12, craft: "skiff", level, quiet: true });
    const c = state.craft;
    c.x = 30;
    c.z = 350;
    let maxSpeed = 0;
    for (let i = 0; i < 60 * TUNING.physicsHz; i++) {
      const t = state.t;
      const input: CraftInput = {
        steer: Math.sin(t * 0.4) * 0.35,
        throttle: 1,
        reverse: 0,
        lean: 0,
        reset: false,
      };
      step(state, input);
      expect(finite(state), `step ${i}`).toBe(true);
      maxSpeed = Math.max(maxSpeed, c.speed);
      expect(c.speed).toBeLessThan(45);
      expect(Math.abs(c.y)).toBeLessThan(12);
      expect(Math.hypot(c.wx, c.wy, c.wz)).toBeLessThan(25);
    }
    expect(maxSpeed).toBeGreaterThan(15);
    expect(c.y).toBeGreaterThan(-2);
  });

  it("survives a gale, upwind and down, and a ridden reset", () => {
    const level = syntheticLevel({ windSpeed: 12, noSolids: true, seaward: 800 });
    const state = createGame({ seed: 5, craft: "dart", level, quiet: true });
    state.craft.x = 200;
    state.craft.z = 400;
    for (let i = 0; i < 60 * TUNING.physicsHz; i++) {
      const t = state.t;
      const input: CraftInput = {
        steer: Math.sin(t * 0.15) * 0.6,
        throttle: 0.5 + 0.5 * Math.sin(t),
        reverse: 0,
        lean: Math.sin(t * 0.5),
        reset: i === 30 * TUNING.physicsHz,
      };
      step(state, input);
      expect(finite(state), `step ${i}`).toBe(true);
    }
  });

  it("a placed flight, a capsize and a beach all stay finite", () => {
    const level = syntheticLevel({ windSpeed: 8 });
    const state = createGame({ seed: 3, craft: "otter", level, quiet: true });
    const c = state.craft;
    c.x = 100;
    c.z = 60;
    c.y = 25;
    c.vy = -5;
    c.wx = 6;
    c.wz = 4;
    for (let i = 0; i < 30 * TUNING.physicsHz; i++) {
      step(state, { steer: 1, throttle: 1, reverse: 0, lean: -1, reset: false });
      expect(finite(state), `step ${i}`).toBe(true);
    }
  });
});

describe("the bot on generated levels", () => {
  const SEEDS = [1, 2, 3];
  for (const seed of SEEDS) {
    it(`finishes seed ${seed} on the skiff`, () => {
      const level = generateLevel(seed);
      const report = simulateStage({ seed, craft: "skiff", level, maxSeconds: SIM_SECONDS });
      expect(
        report.finished,
        `seed ${seed}: ${report.gatesPassed}/${report.gates}, ${report.resets} resets`,
      ).toBe(true);
      // A generated basin may put a bend where a hull at pace runs wide
      // onto it once or twice; a run that keeps resetting is lost.
      expect(report.resets).toBeLessThanOrEqual(2);
      // Every gate is either taken or paid for — nothing is skipped
      // silently.
      expect(report.gatesPassed + report.gatesMissed).toBe(report.gates);
      // A pace worth calling a race. Lower than a straight coast's, and
      // that is the WATER rather than the corners: a course-first level
      // (R24) runs in every direction relative to the swell, so a leg into
      // a head sea is ridden at a third of the pace of one across it — the
      // same hull rides seed 3 (wind 8.5 m/s) at 40 km/h and seed 2 (13.5)
      // at 25. MEASURED at twenty-two to fifty-one km/h over seeds 1 to 3
      // with all four craft, so this refuses a rider who has stopped
      // riding rather than one who is meeting the sea.
      const avgKmh = (report.courseLength / report.time) * 3.6;
      expect(avgKmh).toBeGreaterThan(18);
      expect(avgKmh).toBeLessThan(100);
    });
  }

  it("the same seed digests the same twice", () => {
    const a = simulateStage({ seed: 2, craft: "marlin", maxSeconds: SIM_SECONDS });
    const b = simulateStage({ seed: 2, craft: "marlin", maxSeconds: SIM_SECONDS });
    expect(a.digest).toBe(b.digest);
  });
});
