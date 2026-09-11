// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The input maths, DOM-free: the key ramps, the throttle lever, the
// handlebar, the merge of thumbs and keys, and the one sign flip between
// the screen and the engine (pwa/src/game/input-model.ts). The listeners
// that feed it are the browser's; everything that decides what the engine
// is handed is here, and this is what holds it.
import { describe, expect, it } from "vitest";

import { TUNING } from "@engine";

import {
  BAR_REACH_PX,
  KEY_STEER_ATTACK,
  LEAN_DEAD_PX,
  LEAN_REACH_PX,
  LEVER_FULL_PX,
  LEVER_REVERSE_PX,
  NO_KEYS,
  SCREEN_TO_ENGINE,
  barLean,
  barSteer,
  createInputModel,
  leverReverse,
  leverThrottle,
  neutralTouch,
  rampToward,
  sampleInput,
} from "../pwa/src/game/input-model.ts";

const DT = TUNING.dt;

describe("the throttle lever", () => {
  it("is WIDE OPEN at the anchor, and stays open below it", () => {
    // The whole point of the anchor: a thumb that lands anywhere — low on
    // the glass included, where there is no room left to drag — is already
    // asking for everything the pump has.
    expect(leverThrottle(0)).toBe(1);
    expect(leverThrottle(40)).toBe(1);
    expect(leverThrottle(LEVER_FULL_PX * 3)).toBe(1);
  });

  it("closes with a drag UP, analogue, shut at the stated travel", () => {
    expect(leverThrottle(-LEVER_FULL_PX / 2)).toBeCloseTo(0.5, 9);
    expect(leverThrottle(-LEVER_FULL_PX)).toBe(0);
    expect(leverThrottle(-LEVER_FULL_PX * 3)).toBe(0);
    // Monotonic the whole way: more lift is never more pump.
    let last = 1;
    for (let px = 0; px >= -LEVER_FULL_PX; px -= 5) {
      const v = leverThrottle(px);
      expect(v).toBeLessThanOrEqual(last);
      last = v;
    }
  });
});

describe("the handlebar", () => {
  it("steers with sideways travel, full lock at the reach, curved so the first pixels buy less", () => {
    expect(barSteer(0)).toBe(0);
    expect(barSteer(BAR_REACH_PX)).toBeCloseTo(1, 9);
    expect(barSteer(-BAR_REACH_PX)).toBeCloseTo(-1, 9);
    expect(barSteer(BAR_REACH_PX * 2)).toBeCloseTo(1, 9);
    // Just past linear: half the travel is a little less than half the lock.
    const half = barSteer(BAR_REACH_PX / 2);
    expect(half).toBeLessThan(0.5);
    expect(half).toBeGreaterThan(0.4);
    // Odd: a drag left is the mirror of a drag right.
    expect(barSteer(-30)).toBeCloseTo(-barSteer(30), 12);
  });

  it("leans back with a pull toward the rider, forward with a push, nothing inside the dead band", () => {
    expect(barLean(0)).toBe(0);
    expect(barLean(LEAN_DEAD_PX - 1)).toBe(0);
    expect(barLean(-(LEAN_DEAD_PX - 1))).toBe(0);
    expect(barLean(LEAN_DEAD_PX + LEAN_REACH_PX)).toBeCloseTo(1, 9);
    expect(barLean(-(LEAN_DEAD_PX + LEAN_REACH_PX))).toBeCloseTo(-1, 9);
    expect(barLean(LEAN_DEAD_PX + LEAN_REACH_PX / 2)).toBeCloseTo(0.5, 9);
    expect(barLean(10_000)).toBe(1);
  });
});

describe("the key ramps", () => {
  it("ease toward the target and snap to exactly zero on release", () => {
    let v = 0;
    for (let i = 0; i < 60; i++) v = rampToward(v, 1, DT, KEY_STEER_ATTACK, 9);
    expect(v).toBeGreaterThan(0.9);
    expect(v).toBeLessThanOrEqual(1);
    for (let i = 0; i < 120; i++) v = rampToward(v, 0, DT, KEY_STEER_ATTACK, 9);
    expect(v).toBe(0);
  });

  it("advance by the step's dt, so the same hold is the same lock at any display rate", () => {
    const hold = (dt: number, seconds: number): number => {
      let v = 0;
      for (let t = 0; t < seconds - 1e-9; t += dt) v = rampToward(v, 1, dt, KEY_STEER_ATTACK, 9);
      return v;
    };
    // Coarser and finer steps land within a few percent of each other over
    // the same wall time — the ramp is a rate, not a per-call increment.
    expect(Math.abs(hold(1 / 120, 0.5) - hold(1 / 60, 0.5))).toBeLessThan(0.05);
  });
});

describe("sampleInput", () => {
  it("hands the engine neutral for nothing held", () => {
    const input = sampleInput(createInputModel(), NO_KEYS, neutralTouch(), DT, false);
    expect(input).toEqual({ steer: 0, throttle: 0, reverse: 0, lean: 0, reset: false });
  });

  it("flips the steer sign ONCE: the right key is the engine's negative", () => {
    expect(SCREEN_TO_ENGINE).toBe(-1);
    const model = createInputModel();
    let input = sampleInput(model, { ...NO_KEYS, right: true }, neutralTouch(), DT, false);
    for (let i = 0; i < 240; i++)
      input = sampleInput(model, { ...NO_KEYS, right: true }, neutralTouch(), DT, false);
    expect(input.steer).toBeCloseTo(-1, 3);
    const left = createInputModel();
    let l = sampleInput(left, { ...NO_KEYS, left: true }, neutralTouch(), DT, false);
    for (let i = 0; i < 240; i++)
      l = sampleInput(left, { ...NO_KEYS, left: true }, neutralTouch(), DT, false);
    expect(l.steer).toBeCloseTo(1, 3);
  });

  it("ramps the throttle key rather than switching it, and lets go faster", () => {
    const model = createInputModel();
    const first = sampleInput(model, { ...NO_KEYS, throttle: true }, neutralTouch(), DT, false);
    expect(first.throttle).toBeGreaterThan(0);
    expect(first.throttle).toBeLessThan(0.1);
    let up = first;
    let steps = 1;
    while (up.throttle < 0.9 && steps < 600) {
      up = sampleInput(model, { ...NO_KEYS, throttle: true }, neutralTouch(), DT, false);
      steps++;
    }
    expect(steps).toBeLessThan(120);
    let down = up;
    let off = 0;
    while (down.throttle > 0 && off < 600) {
      down = sampleInput(model, NO_KEYS, neutralTouch(), DT, false);
      off++;
    }
    expect(off).toBeLessThan(steps);
  });

  it("gives the bar the steer and the lean while a thumb is on it, keys or no keys", () => {
    const model = createInputModel();
    for (let i = 0; i < 240; i++)
      sampleInput(model, { ...NO_KEYS, right: true, leanBack: true }, neutralTouch(), DT, false);
    const touch = { ...neutralTouch(), bar: true, steer: -0.3, lean: -0.5 };
    const input = sampleInput(model, { ...NO_KEYS, right: true, leanBack: true }, touch, DT, false);
    expect(input.steer).toBeCloseTo(0.3, 9);
    expect(input.lean).toBe(-0.5);
  });

  it("takes the deeper of the throttle key and the lever", () => {
    const model = createInputModel();
    const touch = { ...neutralTouch(), lever: true, throttle: 0.4 };
    expect(sampleInput(model, NO_KEYS, touch, DT, false).throttle).toBe(0.4);
    for (let i = 0; i < 240; i++)
      sampleInput(model, { ...NO_KEYS, throttle: true }, touch, DT, false);
    expect(
      sampleInput(model, { ...NO_KEYS, throttle: true }, touch, DT, false).throttle,
    ).toBeCloseTo(1, 2);
    // A lever nobody is touching is not a throttle, whatever it last wrote.
    const stale = { ...neutralTouch(), lever: false, throttle: 0.9 };
    expect(sampleInput(createInputModel(), NO_KEYS, stale, DT, false).throttle).toBe(0);
  });

  it("carries the reset edge through exactly once", () => {
    const input = sampleInput(createInputModel(), NO_KEYS, neutralTouch(), DT, true);
    expect(input.reset).toBe(true);
  });

  it("never hands the engine anything outside its ranges", () => {
    const model = createInputModel();
    const touch = { ...neutralTouch(), bar: true, steer: 4, lean: -7, lever: true, throttle: 9 };
    const input = sampleInput(model, NO_KEYS, touch, DT, false);
    expect(input.steer).toBe(-1);
    expect(input.lean).toBe(-1);
    expect(input.throttle).toBe(1);
  });
});

describe("the brake and reverse lever", () => {
  it("is the far end of the same throw: nothing until the throttle has shut", () => {
    expect(leverReverse(0)).toBe(0);
    expect(leverReverse(40)).toBe(0);
    expect(leverReverse(-LEVER_FULL_PX / 2)).toBe(0);
    expect(leverReverse(-LEVER_FULL_PX)).toBe(0);
    expect(leverReverse(-LEVER_FULL_PX - LEVER_REVERSE_PX / 2)).toBeCloseTo(0.5, 9);
    expect(leverReverse(-LEVER_FULL_PX - LEVER_REVERSE_PX)).toBe(1);
    expect(leverReverse(-LEVER_FULL_PX - LEVER_REVERSE_PX * 3)).toBe(1);
  });

  it("and the two never open at once — one throw, the pump then the bucket", () => {
    for (let px = -(LEVER_FULL_PX + LEVER_REVERSE_PX) * 2; px <= LEVER_FULL_PX * 2; px += 5) {
      expect(Math.min(leverThrottle(px), leverReverse(px)), `at ${px}px`).toBe(0);
    }
  });
});

describe("the brake against the throttle", () => {
  it("wins, whichever hand each came from", () => {
    const model = createInputModel();
    const touch = neutralTouch();
    // A thumb pulling the brake while a key holds the throttle down: a
    // rider reaching for the only brake the craft has is not also asking
    // to go faster.
    touch.lever = true;
    touch.reverse = 1;
    let input = sampleInput(model, { ...NO_KEYS, throttle: true }, touch, 1, false);
    expect(input.reverse).toBe(1);
    expect(input.throttle).toBe(0);
    // ...and let go of, the throttle is the rider's again.
    touch.reverse = 0;
    input = sampleInput(model, { ...NO_KEYS, throttle: true }, touch, 1, false);
    expect(input.reverse).toBe(0);
    expect(input.throttle).toBeGreaterThan(0);
  });

  it("ramps on the key and lets go faster than it takes", () => {
    const model = createInputModel();
    const held = sampleInput(model, { ...NO_KEYS, reverse: true }, neutralTouch(), 0.05, false);
    expect(held.reverse).toBeGreaterThan(0);
    expect(held.reverse).toBeLessThan(1);
    const rising = held.reverse;
    const released = sampleInput(model, NO_KEYS, neutralTouch(), 0.05, false);
    expect(released.reverse).toBeLessThan(rising);
  });

  it("is 0 in a neutral sample", () => {
    const input = sampleInput(createInputModel(), NO_KEYS, neutralTouch(), 0.016, false);
    expect(input.reverse).toBe(0);
  });
});
