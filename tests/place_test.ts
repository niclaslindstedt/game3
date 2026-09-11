// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Placing a run at a moment: the craft stands where it is told, at the
// speed and attitude it is told, afloat or in the air, with the clock and
// the progress set — and the next step carries on from there as though it
// had ridden to it.
import { describe, expect, it } from "vitest";

import { NEUTRAL_INPUT, TUNING, createGame, placeRun, restY, step } from "@engine";

import { syntheticLevel } from "./support/synthetic.ts";

const LEVEL = syntheticLevel({ windSpeed: 0, noSolids: true });

describe("placeRun", () => {
  it("stands the craft at rest at a plan point and heading", () => {
    const state = createGame({ seed: 1, craft: "otter", level: LEVEL, quiet: true });
    placeRun(state, { x: 300, z: 150, heading: 1.2 });
    const c = state.craft;
    expect(c.x).toBe(300);
    expect(c.z).toBe(150);
    expect(c.heading).toBeCloseTo(1.2, 9);
    expect(c.speed).toBe(0);
    expect(c.airborne).toBe(false);
    expect(c.y).toBeCloseTo(restY(c.spec, LEVEL.water.density), 6);
    expect(c.rpm).toBe(c.spec.idleRpm);
  });

  it("puts a speed along the heading and the revs to match", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: LEVEL, quiet: true });
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 20 });
    const c = state.craft;
    expect(c.vx).toBeCloseTo(20, 9);
    expect(c.vz).toBeCloseTo(0, 9);
    expect(c.speed).toBeCloseTo(20, 9);
    expect(c.rpm).toBeGreaterThan(c.spec.idleRpm);
    expect(c.throttleEff).toBe(1);
    // ...and rides on from there without a lurch.
    for (let i = 0; i < TUNING.physicsHz; i++)
      step(state, { steer: 0, throttle: 1, reverse: 0, lean: 0, crouch: 0, reset: false });
    expect(c.speed).toBeGreaterThan(17);
    expect(Math.abs(c.pitch)).toBeLessThan(0.3);
  });

  it("stands a craft in the air with an attitude and a climb", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: LEVEL, quiet: true });
    placeRun(state, {
      x: 100,
      z: 200,
      heading: 0,
      speed: 12,
      height: 5,
      vy: 3,
      pitch: 0.3,
      roll: -0.2,
      pitchRate: 1,
    });
    const c = state.craft;
    expect(c.airborne).toBe(true);
    expect(c.y).toBeCloseTo(5, 1);
    expect(c.vy).toBe(3);
    expect(c.pitch).toBeCloseTo(0.3, 9);
    expect(c.roll).toBeCloseTo(-0.2, 9);
    expect(c.wx).toBe(-1);
    step(state, NEUTRAL_INPUT);
    expect(c.airborne).toBe(true);
    expect(c.pitch).toBeGreaterThan(0.3);
  });

  it("sets the clock and the next gate", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: LEVEL, quiet: true });
    placeRun(state, { x: 250, z: 40, heading: Math.PI / 2, speed: 10, time: 42.5, nextGate: 2 });
    expect(state.progress.time).toBe(42.5);
    expect(state.progress.nextGate).toBe(2);
    step(state, { steer: 0, throttle: 1, reverse: 0, lean: 0, crouch: 0, reset: false });
    expect(state.progress.time).toBeCloseTo(42.5 + TUNING.dt, 9);
  });

  it("is deterministic: the same moment twice rides the same", () => {
    const runs = [0, 1].map(() => {
      const state = createGame({
        seed: 4,
        craft: "marlin",
        level: syntheticLevel({ windSpeed: 7 }),
        quiet: true,
      });
      placeRun(state, { x: 150, z: 120, heading: 1, speed: 18 });
      for (let i = 0; i < 300; i++)
        step(state, { steer: 0.3, throttle: 0.8, reverse: 0, lean: 0, crouch: 0, reset: false });
      return [state.craft.x, state.craft.y, state.craft.z, state.craft.heading];
    });
    expect(runs[0]).toEqual(runs[1]);
  });
});
