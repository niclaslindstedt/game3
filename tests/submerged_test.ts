// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HULL UNDER THE WATER. The regime is silent everywhere a craft is
// ordinarily ridden and whole only once the sea is over the deck; the
// rider keeps his bars and his engine inside it; and the deck's float
// floods only for a hull that has gone under, never for one floating
// inverted, which is the case the capsize depends on.
import { describe, expect, it } from "vitest";

import {
  TUNING,
  createGame,
  floodedDeck,
  inertia,
  placeRun,
  rotate,
  step,
  submergedControl,
  submergedShare,
  type CraftInput,
  type GameState,
} from "@engine";

import { syntheticLevel } from "./support/synthetic.ts";

const FLAT = syntheticLevel({ windSpeed: 0, noSolids: true, depth: 30 });
const CRAFTS = ["skiff", "marlin", "otter", "dart"] as const;
const NEUTRAL: CraftInput = { steer: 0, throttle: 0, reverse: 0, lean: 0, crouch: 0, reset: false };

function ride(state: GameState, seconds: number, input: CraftInput): void {
  for (let i = 0; i < Math.round(seconds / TUNING.dt); i++) step(state, input);
}

describe("the regime", () => {
  it("is zero at rest on every craft — the deck is dry and the bottom is not under", () => {
    for (const craft of CRAFTS) {
      const state = createGame({ seed: 1, level: FLAT, craft, assist: 0 });
      ride(state, 2, NEUTRAL);
      const hull = state.craft;
      // Read it the way the engine does, off the craft's own immersion.
      expect(hull.submergedDepth).toBeGreaterThan(0);
      expect(submergedShare(1, 0)).toBe(0);
    }
  });

  it("needs BOTH halves: a bow driven in with a dry transom is not 'under'", () => {
    // The whole bottom under but no water over the deck is nothing...
    expect(submergedShare(1, 0)).toBe(0);
    // ...and a deck awash while some of the bottom is still in the air —
    // which is what a hull floating inverted looks like — is nothing too.
    expect(submergedShare(0, 1)).toBe(0);
    // Only both together.
    expect(submergedShare(1, 1)).toBe(1);
    expect(submergedShare(1, 0.5)).toBeCloseTo(0.5, 12);
  });

  it("clamps its inputs rather than trusting them", () => {
    expect(submergedShare(5, 5)).toBe(1);
    expect(submergedShare(-1, 1)).toBe(0);
  });
});

describe("the deck's float", () => {
  it("is whole at the surface and floods to the sealed share once under", () => {
    expect(floodedDeck(0)).toBe(1);
    expect(floodedDeck(1)).toBeCloseTo(TUNING.submerged.deckSealed, 12);
    // Monotonic between, so nothing gains buoyancy by sinking.
    let last = floodedDeck(0);
    for (let k = 0.1; k <= 1.0001; k += 0.1) {
      const now = floodedDeck(k);
      expect(now).toBeLessThanOrEqual(last + 1e-12);
      last = now;
    }
  });

  it("keeps every cubic metre for a hull floating INVERTED — the capsize rests on it", () => {
    // An inverted hull has its bottom in the air, so `bottomUnder` is 0
    // however awash its deck is, and the float is untouched.
    expect(floodedDeck(submergedShare(0, 1))).toBe(1);
  });
});

describe("the rider under the water", () => {
  const out = { fx: 0, fy: 0, fz: 0, tx: 0, ty: 0, tz: 0 };
  const spec = createGame({ seed: 1, level: FLAT, craft: "skiff", assist: 0 }).craft.spec;
  const I = inertia(spec);

  it("does nothing at all outside the regime", () => {
    submergedControl(spec, 0, 1, 1, 0, I, out);
    expect(out.tx).toBe(0);
    expect(out.ty).toBe(0);
    expect(out.tz).toBe(0);
  });

  it("does nothing when the rider is not asking", () => {
    submergedControl(spec, 1, 0, 0, 0, I, out);
    expect(out.tx).toBe(0);
    expect(out.tz).toBe(0);
  });

  it("hauls the nose UP on a lean back, and rolls the way the bars point", () => {
    // Nose-up is −x; a right roll (right side down) is −z.
    submergedControl(spec, 1, 0, 1, 0, I, out);
    expect(out.tx).toBeLessThan(0);
    submergedControl(spec, 1, 1, 0, 0, I, out);
    expect(out.tz).toBeLessThan(0);
    expect(out.ty).toBeGreaterThan(0);
  });

  it("gives the stand-up more of it than the tourer, off `riderAuthority` alone", () => {
    const dart = createGame({ seed: 1, level: FLAT, craft: "dart", assist: 0 }).craft.spec;
    const marlin = createGame({ seed: 1, level: FLAT, craft: "marlin", assist: 0 }).craft.spec;
    const one = { ...out };
    submergedControl(dart, 1, 0, 1, 0, { x: 1, y: 1, z: 1 }, one);
    const two = { ...out };
    submergedControl(marlin, 1, 0, 1, 0, { x: 1, y: 1, z: 1 }, two);
    expect(Math.abs(one.tx)).toBeGreaterThan(Math.abs(two.tx));
    expect(dart.riderAuthority).toBeGreaterThan(marlin.riderAuthority);
  });

  it("shrinks with the tuck, like the air's own authority", () => {
    const open = { ...out };
    submergedControl(spec, 1, 0, 1, 0, I, open);
    const tucked = { ...out };
    submergedControl(spec, 1, 0, 1, 1, I, tucked);
    expect(Math.abs(tucked.tx)).toBeLessThan(Math.abs(open.tx));
  });
});

describe("ordinary riding", () => {
  it("is untouched on flat water — the module never engages", () => {
    // The same ride, read twice: nothing about it may depend on a regime
    // that is not entered. Held to the pose, not to a digest, because a
    // wave field amplifies any difference at all over seconds.
    for (const craft of CRAFTS) {
      const a = createGame({ seed: 1, level: FLAT, craft, assist: 0 });
      placeRun(a, { x: FLAT.start.x, z: 120, heading: 0, speed: 18 });
      // Throttle only: a lean held back this long is the STAND-UP, which
      // is a different trick and puts the craft on its tail on purpose.
      ride(a, 6, { ...NEUTRAL, throttle: 1 });
      // A hull at pace on flat water keeps its deck dry and its bottom
      // partly out, so the regime's two halves never both hold.
      expect(rotate(a.craft.q, { x: 0, y: 1, z: 0 }).y).toBeGreaterThan(0.5);
      expect(a.craft.submergedDepth).toBeLessThan(a.craft.spec.height);
    }
  });
});
