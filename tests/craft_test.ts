// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The catalog held to its own sheet: every craft reaches its documented top
// speed and 0–50 time on flat water within tolerance, turns at a radius of
// tens of metres under power and barely at all with the throttle shut, and
// the pump and the engine agree with each other. Change a row and this
// says what the change did.
import { describe, expect, it } from "vitest";

import {
  CRAFT,
  TUNING,
  angleDiff,
  createGame,
  curveTorque,
  jetCeiling,
  placeRun,
  pumpTorque,
  staticThrust,
  step,
  topSpeedOf,
  totalMass,
  type CraftInput,
  type GameState,
} from "@engine";

import { syntheticLevel } from "./support/synthetic.ts";

// A long flat sea with nothing on it: the drag strip.
const STRIP = syntheticLevel({ windSpeed: 0, noSolids: true, seaward: 1200 });
const FULL: CraftInput = { steer: 0, throttle: 1, lean: 0, reset: false };

function flatOut(id: string, seconds: number): { top: number; t50: number; state: GameState } {
  const state = createGame({ seed: 1, craft: id as "skiff", level: STRIP, quiet: true });
  placeRun(state, { x: -50, z: 400, heading: Math.PI / 2 });
  for (let i = 0; i < 3 * TUNING.physicsHz; i++) step(state, { ...FULL, throttle: 0 });
  let top = 0;
  let t50 = -1;
  let t = 0;
  for (let i = 0; i < seconds * TUNING.physicsHz; i++) {
    step(state, FULL);
    t += TUNING.dt;
    const kmh = state.craft.speed * 3.6;
    if (t50 < 0 && kmh >= 50) t50 = t;
    if (kmh > top) top = kmh;
  }
  return { top, t50, state };
}

describe("the sheet", () => {
  for (const spec of CRAFT) {
    it(`${spec.id} reaches its top speed within 10% and 0–50 within 20%`, () => {
      const { top, t50, state } = flatOut(spec.id, 24);
      expect(top, "top speed km/h").toBeGreaterThan(spec.topSpeed * 0.9);
      expect(top, "top speed km/h").toBeLessThan(spec.topSpeed * 1.1);
      expect(t50, "0–50 s").toBeGreaterThan(spec.accel0to50 * 0.8);
      expect(t50, "0–50 s").toBeLessThan(spec.accel0to50 * 1.2);
      // ...on the plane, level, and still in the water.
      const c = state.craft;
      expect(c.planing).toBeGreaterThan(0.3);
      expect(c.airborne).toBe(false);
      expect(Math.abs(c.pitch)).toBeLessThan(0.15);
      expect(Math.abs(c.roll)).toBeLessThan(0.05);
      // The engine is near the limiter with the pump matched to it.
      expect(c.rpm).toBeGreaterThan(spec.maxRpm * 0.88);
    });
  }

  it("the sheet sits inside the real range of personal watercraft", () => {
    for (const spec of CRAFT) {
      expect(spec.mass).toBeGreaterThanOrEqual(150);
      expect(spec.mass).toBeLessThanOrEqual(420);
      expect(spec.powerKw).toBeGreaterThanOrEqual(60);
      expect(spec.powerKw).toBeLessThanOrEqual(230);
      expect(spec.topSpeed).toBeGreaterThanOrEqual(70);
      expect(spec.topSpeed).toBeLessThanOrEqual(110);
      expect(spec.deadrise).toBeGreaterThanOrEqual(16);
      expect(spec.deadrise).toBeLessThanOrEqual(24);
      expect(spec.riderMass).toBeGreaterThanOrEqual(75);
      expect(spec.riderMass).toBeLessThanOrEqual(85);
      expect(spec.maxRpm).toBeGreaterThanOrEqual(7000);
      expect(spec.maxRpm).toBeLessThanOrEqual(8000);
      // The hull is denser than the water would like: it floats, part in.
      const density = totalMass(spec) / spec.displacement;
      expect(density).toBeGreaterThan(300);
      expect(density).toBeLessThan(900);
    }
  });

  it("the four are actually different", () => {
    const tops = CRAFT.map((c) => c.topSpeed);
    expect(new Set(tops).size).toBe(4);
    const masses = CRAFT.map((c) => c.mass);
    expect(Math.max(...masses) / Math.min(...masses)).toBeGreaterThan(2);
    const marlin = CRAFT.find((c) => c.id === "marlin")!;
    const dart = CRAFT.find((c) => c.id === "dart")!;
    expect(marlin.topSpeed).toBe(Math.max(...tops));
    expect(dart.mass).toBe(Math.min(...masses));
  });
});

describe("the pump", () => {
  for (const spec of CRAFT) {
    it(`${spec.id}'s pump is matched to its engine at the limiter`, () => {
      const density = 1005;
      const pump = pumpTorque(spec, density, spec.maxRpm, true);
      const engine = curveTorque(spec, spec.maxRpm);
      expect(pump / engine).toBeGreaterThan(0.85);
      expect(pump / engine).toBeLessThan(1.05);
      // The rated power lands on the curve at redline.
      const power = (engine * spec.maxRpm * 2 * Math.PI) / 60;
      expect(power / 1000).toBeCloseTo(spec.powerKw, 0);
      // Static pull is of the order of the weight — a jet ski, not a tug.
      const pull = staticThrust(spec, density);
      const weight = totalMass(spec) * TUNING.g;
      expect(pull / weight).toBeGreaterThan(0.6);
      expect(pull / weight).toBeLessThan(1.6);
      // The jet leaves faster than the hull can ever go.
      expect(jetCeiling(spec)).toBeGreaterThan(topSpeedOf(spec) * 1.15);
    });
  }

  it("the engine revs free to the limiter with the intake out of the water", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: STRIP, quiet: true });
    placeRun(state, { x: 100, z: 400, heading: Math.PI / 2, speed: 15, height: 6, vy: 8 });
    for (let i = 0; i < 60; i++) step(state, FULL);
    expect(state.craft.airborne).toBe(true);
    expect(state.craft.rpm).toBeGreaterThan(state.craft.spec.maxRpm * 0.98);
  });
});

describe("steering", () => {
  function turned(id: string, throttle: number): { heading: number; radius: number; roll: number } {
    const state = createGame({ seed: 1, craft: id as "skiff", level: STRIP, quiet: true });
    placeRun(state, { x: 100, z: 700, heading: Math.PI / 2, speed: 20 });
    const h0 = state.craft.heading;
    let radius = Infinity;
    let maxRoll = 0;
    for (let i = 0; i < 4 * TUNING.physicsHz; i++) {
      step(state, { steer: 1, throttle, lean: 0, reset: false });
      const c = state.craft;
      if (i > 2 * TUNING.physicsHz && Math.abs(c.wy) > 0.05) {
        radius = Math.min(radius, c.speed / Math.abs(c.wy));
      }
      maxRoll = Math.max(maxRoll, c.roll);
    }
    return { heading: angleDiff(h0, state.craft.heading), radius, roll: maxRoll };
  }

  for (const spec of CRAFT) {
    it(`${spec.id} turns at tens of metres under power and barely without`, () => {
      const on = turned(spec.id, 1);
      const off = turned(spec.id, 0);
      // Clockwise, as positive steer says.
      expect(on.heading).toBeGreaterThan(0.6);
      expect(on.radius).toBeGreaterThan(4);
      expect(on.radius).toBeLessThan(80);
      // The throttle IS the steering: shut, the hull runs on. The stand-up
      // is the exception by design — its rider steers it by leaning, and
      // a leaned V bottom carves whether the pump is pushing or not.
      const ratio = spec.id === "dart" ? 1.2 : 1.8;
      expect(on.heading / Math.max(off.heading, 1e-3)).toBeGreaterThan(ratio);
      expect(off.heading).toBeLessThan(1.2);
      // ...and it banks INTO the turn, never out of it. The stand-up lays
      // over the way its riders do.
      expect(on.roll).toBeGreaterThan(0.05);
      expect(on.roll).toBeLessThan(spec.id === "dart" ? 1.6 : 0.9);
    });
  }

  it("the nozzle follows the hand, at the cable's rate", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: STRIP, quiet: true });
    placeRun(state, { x: 100, z: 400, heading: 0, speed: 10 });
    step(state, { steer: 1, throttle: 1, lean: 0, reset: false });
    const first = state.craft.nozzle;
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(state.craft.spec.nozzleAngle);
    for (let i = 0; i < 60; i++) step(state, { steer: 1, throttle: 1, lean: 0, reset: false });
    expect(state.craft.nozzle).toBeCloseTo(state.craft.spec.nozzleAngle, 6);
    for (let i = 0; i < 60; i++) step(state, { steer: -1, throttle: 1, lean: 0, reset: false });
    expect(state.craft.nozzle).toBeCloseTo(-state.craft.spec.nozzleAngle, 6);
  });

  it("leaning back at speed lifts the nose", () => {
    const run = (lean: number): number => {
      const state = createGame({ seed: 1, craft: "otter", level: STRIP, quiet: true });
      placeRun(state, { x: 100, z: 400, heading: Math.PI / 2, speed: 12 });
      let sum = 0;
      for (let i = 0; i < 3 * TUNING.physicsHz; i++) {
        step(state, { steer: 0, throttle: 1, lean, reset: false });
        if (i > 2 * TUNING.physicsHz) sum += state.craft.pitch;
      }
      return sum / TUNING.physicsHz;
    };
    expect(run(1)).toBeGreaterThan(run(0) + 0.006);
    expect(run(-1)).toBeLessThan(run(0) - 0.006);
  });
});
