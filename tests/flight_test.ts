// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The air over the water: a placed flight follows a ballistic arc and comes
// down with a `land`, a ramp at speed launches, a nose-down landing costs
// far more than a flat one, a big ramp with the lean held back completes a
// backflip, and the orientation algebra under all of it round-trips.
import { describe, expect, it } from "vitest";

import {
  TUNING,
  createGame,
  fromEuler,
  integrate,
  placeRun,
  rotate,
  step,
  toEuler,
  type CraftInput,
  type GameEvent,
  type GameState,
} from "@engine";

import { syntheticLevel } from "./support/synthetic.ts";

const FLAT = syntheticLevel({ windSpeed: 0, noSolids: true });
/** Where the level's ramp stands, so a run can be placed before it. */
function rampOf(level: typeof FLAT): { x: number; z: number } {
  const ramp = level.course.gates.find((g) => g.kind === "air")!.ramp!;
  return { x: ramp.x, z: ramp.z };
}
const FULL: CraftInput = { steer: 0, throttle: 1, lean: 0, reset: false };
const COAST: CraftInput = { steer: 0, throttle: 0, lean: 0, reset: false };

function ride(
  state: GameState,
  seconds: number,
  input: (state: GameState) => CraftInput,
): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < seconds * TUNING.physicsHz; i++) {
    step(state, input(state));
    events.push(...state.events);
  }
  return events;
}

describe("orientation", () => {
  it("round-trips heading, pitch and roll", () => {
    for (const [h, p, r] of [
      [0.3, 0.2, 0.1],
      [-2.5, -0.7, 1.2],
      [1, 1.2, -2.9],
      [3, -1.4, 0.4],
    ]) {
      const e = toEuler(fromEuler(h, p, r));
      expect(e.heading).toBeCloseTo(h, 9);
      expect(e.pitch).toBeCloseTo(p, 9);
      expect(e.roll).toBeCloseTo(r, 9);
    }
  });

  it("heading 0 is +z and grows clockwise; nose-up is a negative x rate", () => {
    const f = rotate(fromEuler(0.5, 0, 0), { x: 0, y: 0, z: 1 });
    expect(f.x).toBeCloseTo(Math.sin(0.5), 9);
    expect(f.z).toBeCloseTo(Math.cos(0.5), 9);
    let q = fromEuler(0, 0, 0);
    for (let i = 0; i < 120; i++) q = integrate(q, -0.5, 0, 0, 1 / 120);
    expect(toEuler(q).pitch).toBeCloseTo(0.5, 6);
    q = fromEuler(0, 0, 0);
    for (let i = 0; i < 120; i++) q = integrate(q, 0, 0.5, 0, 1 / 120);
    expect(toEuler(q).heading).toBeCloseTo(0.5, 6);
    q = fromEuler(0, 0, 0);
    for (let i = 0; i < 120; i++) q = integrate(q, 0, 0, -0.5, 1 / 120);
    expect(toEuler(q).roll).toBeCloseTo(0.5, 6);
  });
});

describe("a flight", () => {
  it("follows a ballistic arc and lands", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: FLAT, quiet: true });
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 15, height: 1.5, vy: 6 });
    const y0 = state.craft.y;
    // The apex: 6 m/s up is 0.61 s and 1.83 m, less a little air drag.
    let apex = 0;
    let apexT = 0;
    let t = 0;
    const events: GameEvent[] = [];
    while (t < 3) {
      step(state, COAST);
      t += TUNING.dt;
      events.push(...state.events);
      if (state.craft.y > apex) {
        apex = state.craft.y;
        apexT = t;
      }
    }
    expect(apex - y0).toBeGreaterThan(1.6);
    expect(apex - y0).toBeLessThan(1.9);
    expect(apexT).toBeGreaterThan(0.5);
    expect(apexT).toBeLessThan(0.7);
    const land = events.find((e) => e.kind === "land");
    expect(land).toBeDefined();
    if (land?.kind === "land") {
      expect(land.vy).toBeLessThan(-5);
      expect(land.airTime).toBeGreaterThan(1);
      expect(land.airTime).toBeLessThan(1.8);
    }
    expect(state.craft.airborne).toBe(false);
    expect(state.craft.airTime).toBe(0);
  });

  it("a ramp at 12 m/s launches the hull", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: FLAT, quiet: true });
    const ramp = rampOf(FLAT);
    placeRun(state, { x: ramp.x - 30, z: ramp.z, heading: Math.PI / 2, speed: 12 });
    let maxAir = 0;
    let onRamp = false;
    const events = ride(state, 6, (s) => {
      maxAir = Math.max(maxAir, s.craft.airTime);
      onRamp ||= s.craft.onRamp;
      return FULL;
    });
    expect(onRamp).toBe(true);
    const launch = events.find((e) => e.kind === "launch");
    expect(launch).toBeDefined();
    if (launch?.kind === "launch") expect(launch.vy).toBeGreaterThan(2.5);
    expect(maxAir).toBeGreaterThan(0.8);
    expect(events.some((e) => e.kind === "land")).toBe(true);
  });

  it("a ramp at walking pace does not", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: FLAT, quiet: true });
    const ramp = rampOf(FLAT);
    placeRun(state, { x: ramp.x - 10, z: ramp.z, heading: Math.PI / 2, speed: 2 });
    const events = ride(state, 5, () => COAST);
    expect(events.some((e) => e.kind === "launch")).toBe(false);
  });

  function landing(pitch: number): { loss: number; dived: boolean } {
    const state = createGame({ seed: 1, craft: "skiff", level: FLAT, quiet: true });
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 22, height: 3, pitch });
    let landedAt = -1;
    let atLanding = 0;
    let min = Infinity;
    let dived = false;
    let t = 0;
    for (let i = 0; i < 3 * TUNING.physicsHz; i++) {
      step(state, COAST);
      t += TUNING.dt;
      for (const e of state.events) {
        if (e.kind === "land") {
          landedAt = t;
          atLanding = state.craft.speed;
        }
        if (e.kind === "dive") dived = true;
      }
      if (landedAt > 0 && t - landedAt <= 1) min = Math.min(min, state.craft.speed);
    }
    expect(landedAt).toBeGreaterThan(0);
    return { loss: atLanding - min, dived };
  }

  it("a nose-down landing decelerates much harder than a flat one, and is a dive", () => {
    const flat = landing(0.05);
    const nose = landing(-0.55);
    expect(nose.loss).toBeGreaterThan(flat.loss * 2.5);
    expect(nose.loss).toBeGreaterThan(8);
    expect(nose.dived).toBe(true);
    expect(flat.dived).toBe(false);
  });

  it("a big ramp with the lean held back completes a backflip", () => {
    const big = syntheticLevel({ windSpeed: 0, noSolids: true, rampAngle: 0.5, rampLength: 10 });
    const state = createGame({ seed: 1, craft: "skiff", level: big, quiet: true });
    const ramp = rampOf(big);
    placeRun(state, { x: ramp.x - 40, z: ramp.z, heading: Math.PI / 2, speed: 20 });
    let rotation = 0;
    let maxAir = 0;
    ride(state, 8, (s) => {
      const c = s.craft;
      if (c.airborne) {
        // Nose-up pitch rate is −wx; summed while aloft it is how far the
        // hull has gone over.
        rotation += -c.wx * TUNING.dt;
        maxAir = Math.max(maxAir, c.airTime);
      }
      return { steer: 0, throttle: 1, lean: c.airborne || c.onRamp ? 1 : 0, reset: false };
    });
    expect(maxAir).toBeGreaterThan(1.5);
    expect(rotation).toBeGreaterThan(2 * Math.PI);
  });

  it("the same ramp levelled by the rider lands upright and rides on", () => {
    const big = syntheticLevel({ windSpeed: 0, noSolids: true, rampAngle: 0.5, rampLength: 10 });
    const state = createGame({ seed: 1, craft: "skiff", level: big, quiet: true });
    const ramp = rampOf(big);
    placeRun(state, { x: ramp.x - 40, z: ramp.z, heading: Math.PI / 2, speed: 20 });
    const events = ride(state, 8, (s) => {
      const c = s.craft;
      const lean = c.airborne ? Math.max(-1, Math.min(1, (0.1 - c.pitch) * 2.5 + c.wx * 0.9)) : 0;
      return { steer: 0, throttle: 1, lean, reset: false };
    });
    expect(events.some((e) => e.kind === "launch")).toBe(true);
    expect(events.some((e) => e.kind === "land")).toBe(true);
    expect(Math.abs(state.craft.roll)).toBeLessThan(0.3);
    expect(state.craft.speed).toBeGreaterThan(10);
    expect(state.craft.airborne).toBe(false);
  });

  it("in the air the throttle does nothing and the steer rolls", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: FLAT, quiet: true });
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 15, height: 8, vy: 4 });
    const v0 = Math.hypot(state.craft.vx, state.craft.vz);
    for (let i = 0; i < 40; i++) step(state, { steer: 1, throttle: 1, lean: 0, reset: false });
    expect(state.craft.airborne).toBe(true);
    // No thrust: horizontal speed can only have fallen (air drag).
    expect(Math.hypot(state.craft.vx, state.craft.vz)).toBeLessThanOrEqual(v0);
    expect(state.craft.roll).toBeGreaterThan(0.02);
  });
});
