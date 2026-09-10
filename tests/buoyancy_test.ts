// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Archimedes, held: a craft at rest floats at the draft its mass and
// displacement imply, a denser one sits lower, a heeled one comes back
// upright, and one all the way over still floats.
import { describe, expect, it } from "vitest";

import {
  CRAFT,
  NEUTRAL_INPUT,
  TUNING,
  createGame,
  hullProbes,
  placeRun,
  restY,
  step,
  totalMass,
  type GameState,
} from "@engine";

import { syntheticLevel } from "./support/synthetic.ts";

const STILL = syntheticLevel({ windSpeed: 0, noSolids: true });

function settle(state: GameState, seconds: number): void {
  for (let i = 0; i < seconds * TUNING.physicsHz; i++) step(state, NEUTRAL_INPUT);
}

/** The volume the probes hold under a still surface for the craft's
 * current pose, m³ — Archimedes' left-hand side. */
function submergedVolume(state: GameState): number {
  const c = state.craft;
  const probes = hullProbes(c.spec);
  let v = 0;
  const sr = Math.sin(c.roll);
  const cr = Math.cos(c.roll);
  const sp = Math.sin(c.pitch);
  const cp = Math.cos(c.pitch);
  for (const p of probes) {
    // Body → world height for a level heading: pitch then roll.
    const y = c.y + p.y * cr * cp - p.x * sr + p.z * sp;
    const fill = Math.max(0, Math.min(1, -y / p.height));
    v += p.volume * fill;
  }
  return v;
}

describe("the rest draft", () => {
  for (const spec of CRAFT) {
    it(`${spec.id} floats displacing its own weight of water`, () => {
      const state = createGame({ seed: 1, craft: spec.id, level: STILL, quiet: true });
      placeRun(state, { x: 100, z: 200, heading: 0 });
      settle(state, 8);
      const c = state.craft;
      const density = STILL.water.density;
      const need = totalMass(spec) / density;
      expect(submergedVolume(state) / need).toBeGreaterThan(0.95);
      expect(submergedVolume(state) / need).toBeLessThan(1.05);
      expect(Math.abs(c.y - restY(spec, density))).toBeLessThan(0.04);
      expect(Math.abs(c.pitch)).toBeLessThan(0.06);
      expect(Math.abs(c.roll)).toBeLessThan(0.02);
      // An idling jet creeps; the draft is read on the way.
      expect(Math.hypot(c.vx, c.vy, c.vz)).toBeLessThan(2.5);
      expect(Math.abs(c.vy)).toBeLessThan(0.05);
      expect(c.airborne).toBe(false);
      expect(c.wetted).toBeGreaterThan(0.5);
    });
  }

  it("a denser hull sits lower", () => {
    const skiff = CRAFT[0];
    const light = restY(skiff, 1005);
    const heavy = restY({ ...skiff, mass: skiff.mass + 80 }, 1005);
    const salt = restY(skiff, 1025);
    expect(heavy).toBeLessThan(light - 0.02);
    expect(salt).toBeGreaterThan(light);
  });

  it("fresh water floats a craft lower than the brackish shore", () => {
    const fresh = createGame({
      seed: 1,
      craft: "otter",
      level: syntheticLevel({ windSpeed: 0, density: 1000, noSolids: true }),
      quiet: true,
    });
    const salt = createGame({
      seed: 1,
      craft: "otter",
      level: syntheticLevel({ windSpeed: 0, density: 1025, noSolids: true }),
      quiet: true,
    });
    placeRun(fresh, { x: 100, z: 200, heading: 0 });
    placeRun(salt, { x: 100, z: 200, heading: 0 });
    settle(fresh, 6);
    settle(salt, 6);
    expect(fresh.craft.y).toBeLessThan(salt.craft.y);
  });
});

describe("stability", () => {
  const heels: [string, number][] = [
    ["skiff", 1.0],
    ["marlin", 1.0],
    ["otter", 1.0],
    // The stand-up is the least stable of the four by design.
    ["dart", 0.55],
  ];
  for (const [id, heel] of heels) {
    it(`${id} rights itself from a ${Math.round((heel * 180) / Math.PI)}° heel`, () => {
      const state = createGame({ seed: 1, craft: id as "skiff", level: STILL, quiet: true });
      placeRun(state, { x: 100, z: 200, heading: 0, roll: heel });
      settle(state, 12);
      expect(Math.abs(state.craft.roll)).toBeLessThan(0.12);
      expect(Math.abs(state.craft.pitch)).toBeLessThan(0.1);
    });
  }

  it("an inverted hull floats, and the rider rights it after a moment", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: STILL, quiet: true });
    placeRun(state, { x: 100, z: 200, heading: 0, roll: Math.PI - 0.05 });
    // Before the rider has climbed back on: upside down, but afloat — the
    // centre of gravity within half a metre of the surface, not eight
    // metres down.
    const events: string[] = [];
    for (let i = 0; i < 1.2 * TUNING.physicsHz; i++) {
      step(state, NEUTRAL_INPUT);
      for (const e of state.events) events.push(e.kind);
    }
    expect(state.craft.y).toBeGreaterThan(-0.6);
    expect(Math.abs(state.craft.roll)).toBeGreaterThan(2.5);
    expect(events).not.toContain("capsize");
    // Then the rule (`TUNING.capsize`): a `capsize` event, and the hull
    // back upright at its draft with the engine idling and no way on —
    // the throttle is held through it to show the engine cut.
    let idledWhileRighting = false;
    for (let i = 0; i < 1.5 * TUNING.physicsHz; i++) {
      step(state, { steer: 0, throttle: 1, lean: 0, reset: false });
      for (const e of state.events) events.push(e.kind);
      if (state.craft.righting > 0 && state.craft.rpm === state.craft.spec.idleRpm) {
        idledWhileRighting = true;
      }
    }
    expect(idledWhileRighting).toBe(true);
    for (let i = 0; i < 1.5 * TUNING.physicsHz; i++) {
      step(state, NEUTRAL_INPUT);
      for (const e of state.events) events.push(e.kind);
    }
    expect(events.filter((k) => k === "capsize").length).toBe(1);
    expect(Math.abs(state.craft.roll)).toBeLessThan(0.15);
    expect(Math.abs(state.craft.pitch)).toBeLessThan(0.15);
    expect(state.craft.righting).toBe(0);
    expect(Math.abs(state.craft.y - restY(state.craft.spec, STILL.water.density))).toBeLessThan(
      0.1,
    );
    expect(state.craft.speed).toBeLessThan(6);
  });

  it("a capsize is deterministic and rights the same way twice", () => {
    const runs = [0, 1].map(() => {
      const state = createGame({
        seed: 3,
        craft: "dart",
        level: syntheticLevel({ windSpeed: 6 }),
        quiet: true,
      });
      placeRun(state, { x: 150, z: 200, heading: 1, roll: 3, speed: 4 });
      for (let i = 0; i < 6 * TUNING.physicsHz; i++) step(state, NEUTRAL_INPUT);
      return [state.craft.x, state.craft.z, state.craft.roll, state.craft.heading];
    });
    expect(runs[0]).toEqual(runs[1]);
    expect(Math.abs(runs[0][2])).toBeLessThan(0.15);
  });

  it("at rest the engine idles and the pump only creeps", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: STILL, quiet: true });
    placeRun(state, { x: 100, z: 200, heading: 0 });
    settle(state, 4);
    expect(state.craft.rpm).toBe(state.craft.spec.idleRpm);
    // An idling jet makes a little way, the way a real one does.
    expect(state.craft.speed).toBeLessThan(2.5);
    expect(Math.abs(state.craft.x - 100)).toBeLessThan(0.5);
  });
});
