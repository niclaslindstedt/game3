// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Contact with what is not water: a skerry pushes the hull out and reports
// a hit, a beach grounds it and reports it, a ramp carries it up its deck,
// a reef the keel clears is no contact at all, and the edge of the level is
// a slope back in rather than a wall.
import { describe, expect, it } from "vitest";

import {
  TUNING,
  boundsPush,
  createGame,
  onRampDeck,
  placeRun,
  rampDeckY,
  step,
  type CraftInput,
  type GameEvent,
  type GameState,
} from "@engine";

import { syntheticLevel } from "./support/synthetic.ts";

const LEVEL = syntheticLevel({ windSpeed: 0 });
const FULL: CraftInput = { steer: 0, throttle: 1, reverse: 0, lean: 0, reset: false };
const COAST: CraftInput = { steer: 0, throttle: 0, reverse: 0, lean: 0, reset: false };

function ride(state: GameState, seconds: number, input: CraftInput): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < seconds * TUNING.physicsHz; i++) {
    step(state, input);
    events.push(...state.events);
  }
  return events;
}

describe("solids", () => {
  it("a skerry hit at speed pushes the hull out and reports it", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: LEVEL, quiet: true });
    // S1 stands at (250, 75), r = 4; run straight at it from the west.
    placeRun(state, { x: 220, z: 75, heading: Math.PI / 2, speed: 12 });
    const events = ride(state, 3, COAST);
    const hit = events.find((e) => e.kind === "hit");
    expect(hit).toBeDefined();
    if (hit?.kind === "hit") {
      expect(hit.solid).toBe("S1");
      expect(hit.speed).toBeGreaterThan(5);
    }
    const c = state.craft;
    expect(Math.hypot(c.x - 250, c.z - 75)).toBeGreaterThan(4);
    expect(c.speed).toBeLessThan(6);
    for (const v of [c.x, c.y, c.z, c.vx, c.vy, c.vz]) expect(Number.isFinite(v)).toBe(true);
  });

  it("a glancing hit keeps most of the way on and yaws the hull", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: LEVEL, quiet: true });
    placeRun(state, { x: 236, z: 72, heading: Math.PI / 2, speed: 12 });
    const h0 = state.craft.heading;
    const events = ride(state, 2, COAST);
    expect(events.some((e) => e.kind === "hit")).toBe(true);
    expect(state.craft.speed).toBeGreaterThan(3);
    expect(Math.abs(state.craft.heading - h0)).toBeGreaterThan(0.05);
  });

  it("a hit reports once, not every step of the contact", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: LEVEL, quiet: true });
    placeRun(state, { x: 240, z: 75, heading: Math.PI / 2, speed: 4 });
    const events = ride(state, 2, FULL);
    const hits = events.filter((e) => e.kind === "hit");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.length).toBeLessThan(6);
  });

  it("a reef the keel clears is passed over", () => {
    const reef = syntheticLevel({ windSpeed: 0 });
    const level = {
      ...reef,
      solids: [{ id: "reef", kind: "reef" as const, x: 150, z: 200, r: 5, top: -1.5 }],
    };
    const state = createGame({ seed: 1, craft: "skiff", level, quiet: true });
    placeRun(state, { x: 120, z: 200, heading: Math.PI / 2, speed: 15 });
    const events = ride(state, 3, FULL);
    expect(events.some((e) => e.kind === "hit")).toBe(false);
    expect(state.craft.x).toBeGreaterThan(160);
  });
});

describe("the ground", () => {
  it("running at the beach grounds the hull and stops it", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: LEVEL, quiet: true });
    // Heading 0 is +z; the shore is at z = 0, so ride south (π) into it.
    placeRun(state, { x: 100, z: 30, heading: Math.PI, speed: 8 });
    const events = ride(state, 6, COAST);
    expect(events.some((e) => e.kind === "ground")).toBe(true);
    const c = state.craft;
    expect(c.z).toBeLessThan(6);
    expect(c.z).toBeGreaterThan(-60);
    expect(c.speed).toBeLessThan(1);
    expect(c.onGround).toBe(true);
    // Stood on the sand, not under it.
    expect(c.y).toBeGreaterThan(-0.5);
  });

  it("a hull cannot be driven through the land", () => {
    const state = createGame({ seed: 1, craft: "marlin", level: LEVEL, quiet: true });
    placeRun(state, { x: 100, z: 20, heading: Math.PI, speed: 25 });
    ride(state, 8, FULL);
    const c = state.craft;
    expect(c.z).toBeGreaterThan(-100);
    expect(Number.isFinite(c.y)).toBe(true);
    expect(c.y).toBeGreaterThan(-1);
  });
});

describe("the ramp", () => {
  it("reads its deck", () => {
    const ramp = LEVEL.course.gates.find((g) => g.kind === "air")!.ramp!;
    const on = onRampDeck(ramp, ramp.x + 4, ramp.z)!;
    expect(on.along).toBeCloseTo(4, 9);
    expect(on.across).toBeCloseTo(0, 9);
    expect(onRampDeck(ramp, ramp.x + 4, ramp.z + 10)).toBeNull();
    expect(onRampDeck(ramp, ramp.x + ramp.length + 1, ramp.z)).toBeNull();
    // The approach lip behind the hinge is on the deck, under water.
    expect(onRampDeck(ramp, ramp.x - 2, ramp.z)).not.toBeNull();
    expect(rampDeckY(ramp, 0)).toBe(0);
    expect(rampDeckY(ramp, ramp.length)).toBeCloseTo(ramp.length * Math.tan(ramp.angle), 9);
    expect(rampDeckY(ramp, -2)).toBeLessThan(0);
  });

  it("carries the hull up its deck", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: LEVEL, quiet: true });
    const ramp = LEVEL.course.gates.find((g) => g.kind === "air")!.ramp!;
    placeRun(state, { x: ramp.x - 20, z: ramp.z, heading: Math.PI / 2, speed: 7 });
    let onRamp = false;
    let highest = -1;
    let pitchOnRamp = 0;
    for (let i = 0; i < 4 * TUNING.physicsHz; i++) {
      step(state, FULL);
      const c = state.craft;
      if (c.onRamp) {
        onRamp = true;
        pitchOnRamp = Math.max(pitchOnRamp, c.pitch);
        highest = Math.max(highest, c.y);
      }
    }
    expect(onRamp).toBe(true);
    // Up the deck: the hull rose well above its rest height and pitched
    // toward the ramp's angle.
    expect(highest).toBeGreaterThan(1);
    expect(pitchOnRamp).toBeGreaterThan(0.15);
  });
});

describe("the bounds", () => {
  it("push back inside, harder the further out", () => {
    const inside = boundsPush(LEVEL, 300, 200);
    expect(inside).toEqual({ ax: 0, az: 0 });
    const east = boundsPush(LEVEL, LEVEL.bounds.maxX + 2, 200);
    expect(east.ax).toBeLessThan(0);
    const further = boundsPush(LEVEL, LEVEL.bounds.maxX + 6, 200);
    expect(further.ax).toBeLessThan(east.ax);
    const south = boundsPush(LEVEL, 300, LEVEL.bounds.minZ - 5);
    expect(south.az).toBeGreaterThan(0);
  });

  it("a hull driven at the seaward edge is turned back", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: LEVEL, quiet: true });
    placeRun(state, { x: 300, z: LEVEL.bounds.maxZ - 30, heading: 0, speed: 20 });
    ride(state, 8, FULL);
    expect(state.craft.z).toBeLessThan(LEVEL.bounds.maxZ + 30);
    expect(Number.isFinite(state.craft.z)).toBe(true);
  });
});
