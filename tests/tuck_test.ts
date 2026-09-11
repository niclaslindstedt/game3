// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TUCK held to its bargain (`TUNING.tuck`): the rider down behind the
// bars buys a smaller hole in the air and pays for it in everything they
// steer with their own body.
//
// Both halves are asserted here because both halves are the feature — a
// tuck that only went faster would be a free win, and one that only turned
// worse would be a punishment. The SIZE of the speed half is asserted too,
// and deliberately asserted SMALL: a personal watercraft is stopped by the
// water, not by the air, so 18 % off `cdA` is worth about a km/h flat and
// calm. What makes it a decision is that aerodynamic drag goes as the
// CLOSING speed squared, so the same tuck is worth twice that punching
// into a blow — and that claim is a test of its own below.
import { describe, expect, it } from "vitest";

import {
  CRAFT,
  TUNING,
  aeroForces,
  createGame,
  identity,
  placeRun,
  step,
  type AeroResult,
  type CraftInput,
  type GameState,
} from "@engine";

import { syntheticLevel } from "./support/synthetic.ts";

// A long flat sea with nothing on it, ridden east.
const STRIP = syntheticLevel({ windSpeed: 0, noSolids: true, seaward: 1200 });
const EAST = Math.PI / 2;
const K = TUNING.tuck;

const ride = (over: Partial<CraftInput> = {}): CraftInput => ({
  steer: 0,
  throttle: 1,
  reverse: 0,
  lean: 0,
  crouch: 0,
  reset: false,
  ...over,
});

/** A craft flat out along the strip, tucked or sat up, into `windSpeed` of
 * head wind. Returns the speed it settled at, km/h, and how long it took
 * to reach 50 and 90 km/h. */
function flatOut(
  id: string,
  crouch: number,
  windSpeed = 0,
): { top: number; t50: number; t90: number } {
  const state = createGame({
    seed: 1,
    craft: id as "skiff",
    level: STRIP,
    wind: { from: EAST, speed: windSpeed },
    sea: { hs: 0.01 },
    assist: 0,
    quiet: true,
  });
  placeRun(state, { x: -50, z: 400, heading: EAST });
  const input = ride({ crouch });
  let top = 0;
  let t50 = -1;
  let t90 = -1;
  for (let i = 0; i < 40 * TUNING.physicsHz; i++) {
    step(state, input);
    const kmh = state.craft.speed * 3.6;
    if (t50 < 0 && kmh >= 50) t50 = state.t;
    if (t90 < 0 && kmh >= 90) t90 = state.t;
    // The first seconds are the hump, not the ceiling.
    if (state.t > 12) top = Math.max(top, kmh);
  }
  return { top, t50, t90 };
}

/** The radius of a full-lock turn, m, entered at the SAME speed whether
 * tucked or not: radius goes as v², so letting each hand enter at its own
 * ceiling would credit the tuck with a turn it had not lost. */
function lockRadius(id: string, crouch: number): number {
  const state = createGame({ seed: 1, craft: id as "skiff", level: STRIP, quiet: true });
  placeRun(state, { x: 60, z: 700, heading: EAST, speed: 18 });
  // Two seconds straight to settle the hull and to let the rider actually
  // get down — the crouch has its own lag.
  for (let i = 0; i < 2 * TUNING.physicsHz; i++) step(state, ride({ crouch }));
  let radius = Infinity;
  for (let i = 0; i < 4 * TUNING.physicsHz; i++) {
    step(state, ride({ crouch, steer: 1 }));
    const c = state.craft;
    if (i > 1.5 * TUNING.physicsHz && Math.abs(c.wy) > 0.05) {
      radius = Math.min(radius, c.speed / Math.abs(c.wy));
    }
  }
  return radius;
}

describe("the hole in the air", () => {
  it("takes exactly `dragCut` off the drag area and nothing else", () => {
    const out: AeroResult = { fx: 0, fy: 0, fz: 0, tx: 0, ty: 0, tz: 0 };
    const drag = (crouch: number): number => {
      // Straight and level at 30 m/s down +z, nothing else asked for, and
      // no air share — so the plate, the rider and the damping are all out
      // and what is left is the drag alone.
      aeroForces(CRAFT[0], identity(), 0, 0, 30, 0, 0, 0, 0, 0, 0, 0, 0, crouch, out);
      return -out.fz;
    };
    expect(drag(1) / drag(0)).toBeCloseTo(1 - K.dragCut, 6);
    // ...and it is a RAMP, not a switch: half a tuck is half the cut.
    expect(drag(0.5) / drag(0)).toBeCloseTo(1 - K.dragCut / 2, 6);
  });

  it("leaves the rider less of themselves to throw the craft about with", () => {
    const out: AeroResult = { fx: 0, fy: 0, fz: 0, tx: 0, ty: 0, tz: 0 };
    // Airborne (airShare 1), lean held full back: the hold is a nose-up
    // torque, which in right-handed body axes is negative x.
    const hold = (crouch: number): number => {
      aeroForces(CRAFT[0], identity(), 0, 0, 30, 0, 0, 0, 0, 0, 0, 1, 1, crouch, out);
      return -out.tx;
    };
    expect(hold(1)).toBeLessThan(hold(0));
    expect(hold(1) / hold(0)).toBeGreaterThan(0.2);
  });
});

describe("what the tuck buys", () => {
  for (const spec of CRAFT) {
    it(`${spec.id} goes faster tucked, and not by much`, () => {
      const up = flatOut(spec.id, 0);
      const down = flatOut(spec.id, 1);
      expect(down.top).toBeGreaterThan(up.top);
      // A km/h or so, and never a new craft: the water is what stops a
      // watercraft. A tuck worth five would mean `cdA` had run away.
      const gain = down.top - up.top;
      expect(gain).toBeGreaterThan(0.3);
      expect(gain).toBeLessThan(3);
      // ...and it buys NOTHING off the line, because at 50 km/h the air is
      // a few per cent of the drag and the hump is all of it.
      expect(Math.abs(down.t50 - up.t50)).toBeLessThan(0.1);
    });
  }

  it("is worth more into a head wind than in a calm", () => {
    // Drag goes as the CLOSING speed squared, so the same 18 % is a bigger
    // force the harder the air is coming at you. This is the whole reason
    // the control is interesting rather than a curiosity.
    const calm = flatOut("skiff", 1).top - flatOut("skiff", 0).top;
    const blow = flatOut("skiff", 1, 14).top - flatOut("skiff", 0, 14).top;
    expect(blow).toBeGreaterThan(calm * 1.3);
  });

  it("holds speed into a blow the sat-up rider is losing", () => {
    // The end of the range is where the tuck lands: into 14 m/s the skiff
    // crawls the last 20 km/h sat up and walks it tucked.
    const up = flatOut("skiff", 0, 14);
    const down = flatOut("skiff", 1, 14);
    expect(down.t90).toBeGreaterThan(0);
    expect(down.t90).toBeLessThan(up.t90 * 0.8);
  });
});

describe("what the tuck costs", () => {
  for (const spec of CRAFT) {
    it(`${spec.id} turns wider tucked, at the same entry speed`, () => {
      const up = lockRadius(spec.id, 0);
      const down = lockRadius(spec.id, 1);
      expect(down).toBeGreaterThan(up * 1.1);
    });
  }

  it("costs the stand-up most, because its turn IS the rider", () => {
    // The dart is steered by a man moving his whole mass about; fold him
    // up and there is much less of the craft left. Every other hull keeps
    // more of its turn, and that ordering is the design.
    const cost = (id: string): number => lockRadius(id, 1) / lockRadius(id, 0);
    const dart = cost("dart");
    for (const spec of CRAFT) {
      if (spec.id !== "dart") expect(cost(spec.id)).toBeLessThan(dart);
    }
  });
});

describe("the body, not a switch", () => {
  function held(seconds: number): GameState {
    const state = createGame({ seed: 1, craft: "skiff", level: STRIP, quiet: true });
    placeRun(state, { x: 60, z: 700, heading: EAST, speed: 18 });
    for (let i = 0; i < seconds * TUNING.physicsHz; i++) step(state, ride({ crouch: 1 }));
    return state;
  }

  it("takes a moment to get down, and reaches the tuck it was asked for", () => {
    // One step is a key going down, not a rider: `TUNING.tuck.lag` is what
    // stops a tap mid-corner reading as a posture he never got into.
    expect(held(TUNING.dt).craft.crouch).toBeLessThan(0.05);
    expect(held(K.lag).craft.crouch).toBeGreaterThan(0.5);
    expect(held(4 * K.lag).craft.crouch).toBeGreaterThan(0.95);
  });

  it("comes back up when the key is let go", () => {
    const state = held(1);
    for (let i = 0; i < 4 * K.lag * TUNING.physicsHz; i++) step(state, ride());
    expect(state.craft.crouch).toBeLessThan(0.05);
  });

  it("stands the rider up on a reset", () => {
    const state = held(1);
    expect(state.craft.crouch).toBeGreaterThan(0.9);
    step(state, ride({ crouch: 1, reset: true }));
    expect(state.craft.crouch).toBe(0);
  });
});
