// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HULL UNDER THE WATER. The regime is silent everywhere a craft is
// ordinarily ridden and whole only once the sea is over the deck; the
// rider keeps his bars and his engine inside it; the deck's float floods
// only for a hull that has gone under, never for one floating inverted,
// which is the case the capsize depends on; and a dive is the rider's for
// ten seconds on the gas or one off it, after which — or if the hull comes
// out on its back — the float-up turns it up for him. A dive never ends in
// a capsize.
import { describe, expect, it } from "vitest";

import {
  TUNING,
  createGame,
  floatUpPose,
  floodedDeck,
  fromEuler,
  inertia,
  placeRun,
  riderDrag,
  rotate,
  step,
  stepUnder,
  submergedControl,
  submergedShare,
  toEuler,
  topSpeedOf,
  type CraftInput,
  type GameEvent,
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
    submergedControl(spec, 0, 1, 1, I, out);
    expect(out.tx).toBe(0);
    expect(out.ty).toBe(0);
    expect(out.tz).toBe(0);
  });

  it("does nothing when the rider is not asking", () => {
    submergedControl(spec, 1, 0, 0, I, out);
    expect(out.tx).toBe(0);
    expect(out.tz).toBe(0);
  });

  it("hauls the nose UP on a lean back, and rolls the way the bars point", () => {
    // Nose-up is −x; a right roll (right side down) is −z.
    submergedControl(spec, 1, 0, 1, I, out);
    expect(out.tx).toBeLessThan(0);
    submergedControl(spec, 1, 1, 0, I, out);
    expect(out.tz).toBeLessThan(0);
    expect(out.ty).toBeGreaterThan(0);
  });

  it("gives the stand-up more of it than the tourer, off `riderAuthority` alone", () => {
    const dart = createGame({ seed: 1, level: FLAT, craft: "dart", assist: 0 }).craft.spec;
    const marlin = createGame({ seed: 1, level: FLAT, craft: "marlin", assist: 0 }).craft.spec;
    const one = { ...out };
    submergedControl(dart, 1, 0, 1, { x: 1, y: 1, z: 1 }, one);
    const two = { ...out };
    submergedControl(marlin, 1, 0, 1, { x: 1, y: 1, z: 1 }, two);
    expect(Math.abs(one.tx)).toBeGreaterThan(Math.abs(two.tx));
    expect(dart.riderAuthority).toBeGreaterThan(marlin.riderAuthority);
  });

  it("drags the rider's body against the flow, less of it folded down", () => {
    const q = fromEuler(0, 0, 0);
    const open = { ...out };
    riderDrag(spec, q, 1, 0, 1000, 0, 0, 8, open);
    expect(open.fz).toBeLessThan(0);
    // Above the centre of gravity, so a body pushed aft lifts the nose.
    expect(open.tx).toBeLessThan(0);
    const tucked = { ...out };
    riderDrag(spec, q, 1, 1, 1000, 0, 0, 8, tucked);
    expect(Math.abs(tucked.fz)).toBeLessThan(Math.abs(open.fz));
    expect(Math.abs(tucked.fz)).toBeCloseTo(Math.abs(open.fz) * (1 - TUNING.tuck.dragCut), 9);
    const dry = { ...out };
    riderDrag(spec, q, 0, 0, 1000, 0, 0, 8, dry);
    expect(dry.fz).toBe(0);
  });
});

describe("the float-up's turn", () => {
  it("brings a hull on its back to upright and nose-up inside a second", () => {
    let q = fromEuler(0.4, 0, Math.PI - 0.1);
    for (let i = 0; i < TUNING.physicsHz; i++) q = floatUpPose(q, TUNING.dt);
    // Upright as the float-up means it: the nose held `riseNose` up, which
    // is what takes `up.y` off 1.
    expect(rotate(q, { x: 0, y: 1, z: 0 }).y).toBeGreaterThan(TUNING.submerged.uprightDone);
    const e = toEuler(q);
    expect(e.pitch).toBeCloseTo(TUNING.submerged.riseNose, 1);
    expect(Math.abs(e.roll)).toBeLessThan(0.1);
    // The heading is the rider's and is left alone.
    expect(e.heading).toBeCloseTo(0.4, 6);
  });

  it("turns a hull driven in past vertical back the same way", () => {
    let q = fromEuler(0, -1.3, 0);
    for (let i = 0; i < TUNING.physicsHz; i++) q = floatUpPose(q, TUNING.dt);
    expect(rotate(q, { x: 0, y: 1, z: 0 }).y).toBeGreaterThan(TUNING.submerged.uprightDone);
    expect(toEuler(q).pitch).toBeCloseTo(TUNING.submerged.riseNose, 1);
  });
});

describe("the spell", () => {
  const S = TUNING.submerged;
  function fresh(): GameState {
    return createGame({ seed: 1, level: FLAT, craft: "skiff", assist: 0 });
  }

  it("latches with a gap: in past `enter`, out only under `leave`", () => {
    const c = fresh().craft;
    const events: GameEvent[] = [];
    stepUnder(c, S.enter - 0.01, 1, 1, 0, events);
    expect(c.under).toBe(false);
    stepUnder(c, S.enter, 1, 1, 0, events);
    expect(c.under).toBe(true);
    // Between the two lines the latch holds either way.
    stepUnder(c, (S.enter + S.leave) / 2, 1, 1, 0, events);
    expect(c.under).toBe(true);
    stepUnder(c, S.leave - 0.01, 1, 1, 0, events);
    expect(c.under).toBe(false);
    expect(c.underTime).toBe(0);
  });

  it("reports going under at `counts` and coming out clean under the rider", () => {
    const c = fresh().craft;
    const events: GameEvent[] = [];
    const steps = Math.round(S.counts / TUNING.dt);
    for (let i = 0; i < steps + 1; i++) stepUnder(c, 1, 1, 1, i * TUNING.dt, events);
    expect(events.filter((e) => e.kind === "submerge")).toHaveLength(1);
    expect(c.underTime).toBeGreaterThanOrEqual(S.counts);
    stepUnder(c, 0, 1, 1, 1, events);
    const out = events.find((e) => e.kind === "surface");
    expect(out?.kind === "surface" && out.clean).toBe(true);
    expect(c.floatUp).toBe(false);
    // A spell under the line was a wave over the deck and says nothing.
    const d = fresh().craft;
    const quiet: GameEvent[] = [];
    stepUnder(d, 1, 1, 1, 0, quiet);
    stepUnder(d, 0, 1, 1, 0.01, quiet);
    expect(quiet).toHaveLength(0);
  });

  it("brings the hull up a second after the gas is let go, or after ten seconds on it", () => {
    const c = fresh().craft;
    const events: GameEvent[] = [];
    let t = 0;
    // Two seconds on the gas: nothing.
    for (let i = 0; i < 2 * TUNING.physicsHz; i++) stepUnder(c, 1, 1, 1, (t += TUNING.dt), events);
    expect(c.floatUp).toBe(false);
    // Off it, and just under `holdIdle` later still nothing; then the float-up.
    const idle = Math.round(S.holdIdle / TUNING.dt);
    for (let i = 0; i < idle - 1; i++) stepUnder(c, 1, 1, 0, (t += TUNING.dt), events);
    expect(c.floatUp).toBe(false);
    stepUnder(c, 1, 1, 0, (t += TUNING.dt), events);
    expect(c.floatUp).toBe(true);
    expect(events.some((e) => e.kind === "floatUp")).toBe(true);
    // ...and the surfacing it produces is never clean.
    stepUnder(c, 0, 1, 0, (t += TUNING.dt), events);
    const out = events.find((e) => e.kind === "surface");
    expect(out?.kind === "surface" && out.clean).toBe(false);

    const g = fresh().craft;
    const gas: GameEvent[] = [];
    t = 0;
    for (let i = 0; i < Math.round(S.hold / TUNING.dt) - 1; i++) {
      stepUnder(g, 1, 1, 1, (t += TUNING.dt), gas);
    }
    expect(g.floatUp).toBe(false);
    stepUnder(g, 1, 1, 1, (t += TUNING.dt), gas);
    expect(g.floatUp).toBe(true);
    // Squeezing the gas again resets the idle clock rather than the spell's.
    const h = fresh().craft;
    for (let i = 0; i < idle - 2; i++) stepUnder(h, 1, 1, 0, i * TUNING.dt, []);
    stepUnder(h, 1, 1, 1, 1, []);
    expect(h.gasOff).toBe(0);
  });

  it("floats up a hull that came out on its back, and lets go only once it is upright", () => {
    const c = fresh().craft;
    const events: GameEvent[] = [];
    // A spell that counted, out on its back.
    for (let i = 0; i <= Math.round(S.counts / TUNING.dt); i++)
      stepUnder(c, 1, 1, 1, i * TUNING.dt, events);
    stepUnder(c, 0, -1, 1, 1, events);
    expect(c.floatUp).toBe(true);
    // Still on its back at the surface: the hand holds.
    stepUnder(c, 0, -0.5, 1, 0.02, events);
    expect(c.floatUp).toBe(true);
    stepUnder(c, 0, S.uprightDone, 1, 0.03, events);
    expect(c.floatUp).toBe(false);
    // ...and a spell that ends with the hull on its EAR is floated up too:
    // the surface would roll it the rest of the way, and that is a dive's
    // capsize. Out upright, it is left alone.
    const side = fresh().craft;
    side.dived = true;
    stepUnder(side, 1, 1, 1, 0, []);
    stepUnder(side, 0, S.uprightDone - 0.1, 1, 0.01, []);
    expect(side.floatUp).toBe(true);
    const up = fresh().craft;
    up.dived = true;
    stepUnder(up, 1, 1, 1, 0, []);
    stepUnder(up, 0, S.uprightDone, 1, 0.01, []);
    expect(up.floatUp).toBe(false);
    // ...and is bounded, so a hull it cannot bring up is the capsize's.
    const d = fresh().craft;
    d.dived = true;
    stepUnder(d, 1, 1, 1, 0, []);
    stepUnder(d, 0, -1, 1, 0.01, []);
    expect(d.floatUp).toBe(true);
    for (let i = 0; i < Math.round(S.holdUp / TUNING.dt) + 1; i++) stepUnder(d, 0.5, -1, 1, 1, []);
    expect(d.floatUp).toBe(false);
    // A slam that pushed a hull landed on its back under for a few steps is
    // not a dive: no spell counted, no bow buried, and the capsize has it.
    const e = fresh().craft;
    stepUnder(e, 1, 1, 1, 0, []);
    stepUnder(e, 0, -1, 1, 0.01, []);
    expect(e.floatUp).toBe(false);
  });
});

/** Nose down into the water past a ring, from a height, the way the app's
 * `dive` scenario stages it — the landing every rider learns to avoid,
 * ridden here for what happens after it. */
function dive(
  craft: (typeof CRAFTS)[number],
  seconds: number,
  input: (state: GameState) => CraftInput,
  pitch = -0.6,
  height = 3,
): { state: GameState; events: GameEvent[]; minUp: number; maxCrouch: number } {
  const state = createGame({ seed: 1, level: FLAT, craft, assist: 0 });
  const top = topSpeedOf(state.craft.spec);
  placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: top * 0.9, height, pitch });
  const events: GameEvent[] = [];
  let minUp = 1;
  let maxCrouch = 0;
  for (let i = 0; i < Math.round(seconds / TUNING.dt); i++) {
    step(state, input(state));
    events.push(...state.events);
    minUp = Math.min(minUp, rotate(state.craft.q, { x: 0, y: 1, z: 0 }).y);
    if (state.craft.under) maxCrouch = Math.max(maxCrouch, state.craft.crouch);
  }
  return { state, events, minUp, maxCrouch };
}

const GAS: CraftInput = { ...NEUTRAL, throttle: 1 };

describe("a dive, ridden", () => {
  it("never ends in a capsize: a hull nobody steers is floated up the right way", () => {
    for (const craft of CRAFTS) {
      const { state, events } = dive(craft, 6, () => NEUTRAL);
      expect(
        events.some((e) => e.kind === "capsize"),
        craft,
      ).toBe(false);
      expect(
        events.some((e) => e.kind === "floatUp"),
        craft,
      ).toBe(true);
      expect(rotate(state.craft.q, { x: 0, y: 1, z: 0 }).y, craft).toBeGreaterThan(0.7);
      expect(state.craft.floatUp, craft).toBe(false);
    }
  });

  it("is the rider's while it lasts: the throttle held with no lean is ten seconds under", () => {
    // The stand-up drives itself down and stays there; the float-up is the
    // only thing that ends it, at `hold`.
    const { events } = dive("dart", 12, () => GAS, -0.9, 4);
    const up = events.find((e) => e.kind === "floatUp");
    expect(up?.kind === "floatUp" && up.underTime).toBeCloseTo(TUNING.submerged.hold, 1);
    expect(events.some((e) => e.kind === "capsize")).toBe(false);
  });

  it("is ridden back out clean with the lean back and the gas on", () => {
    for (const craft of ["marlin", "otter"] as const) {
      const { events } = dive(
        craft,
        6,
        (s) => ({ ...GAS, lean: s.craft.under || s.craft.pitch < -0.3 ? 1 : 0 }),
        -0.9,
        4,
      );
      const out = events.find((e) => e.kind === "surface");
      expect(out?.kind === "surface" && out.clean, craft).toBe(true);
      expect(out?.kind === "surface" && out.underTime, craft).toBeGreaterThan(1);
      expect(
        events.some((e) => e.kind === "floatUp"),
        craft,
      ).toBe(false);
      expect(
        events.some((e) => e.kind === "capsize"),
        craft,
      ).toBe(false);
    }
  });

  it("folds the rider down behind the bars for as long as the hull is under", () => {
    const { maxCrouch, state } = dive("dart", 7, () => GAS);
    expect(maxCrouch).toBeGreaterThan(0.9);
    // ...and lets him back up once it is out.
    expect(state.craft.under).toBe(false);
    expect(state.craft.crouch).toBeLessThan(0.1);
  });

  it("keeps the engine running under the water, and the capsize clock stopped", () => {
    let underWithRevs = false;
    let clockRan = false;
    dive("dart", 4, (s) => {
      if (s.craft.under && s.craft.rpm > s.craft.spec.idleRpm * 1.5) underWithRevs = true;
      if (s.craft.under && s.craft.capsizedFor > 0) clockRan = true;
      return GAS;
    });
    expect(underWithRevs).toBe(true);
    expect(clockRan).toBe(false);
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
      expect(a.craft.under).toBe(false);
      expect(a.craft.underTime).toBe(0);
    }
  });
});
