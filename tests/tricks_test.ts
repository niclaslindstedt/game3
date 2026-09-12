// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SCORE: what the rider is paid for the air and for the flips over it
// (`engine/game/tricks.ts`). Every case here is staged on the synthetic
// level with `placeRun`, so what is measured is the scoring rule and not
// whichever wave the generator happened to deal.
//
// The three claims the model makes, each with its assertion: the purse over
// a flight grows faster than the flight does, a revolution's Nth turn is
// worth more than its first, and nothing is banked until the rider is back
// on the water with the craft under him.
import { describe, expect, it } from "vitest";

import {
  TUNING,
  airPointsPerSecond,
  createGame,
  placeRun,
  step,
  type CraftInput,
  type GameEvent,
  type GameState,
} from "@engine";

import { syntheticLevel } from "./support/synthetic.ts";

const FLAT = syntheticLevel({ windSpeed: 0, noSolids: true });
const COAST: CraftInput = { steer: 0, throttle: 0, reverse: 0, lean: 0, crouch: 0, reset: false };

function game(): GameState {
  return createGame({ seed: 1, craft: "skiff", level: FLAT, quiet: true });
}

function ride(
  state: GameState,
  seconds: number,
  input: (state: GameState) => CraftInput = () => COAST,
): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < seconds * TUNING.physicsHz; i++) {
    step(state, input(state));
    events.push(...state.events);
  }
  return events;
}

/** Fly for `vy` m/s upward off calm water and ride until the combo has
 * banked; what came back is the whole purse for that one flight. */
function jump(vy: number, height = 1.5): { banked: number; air: number } {
  const state = game();
  placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 15, height, vy });
  let air = 0;
  const events = ride(state, 3 + vy / 2, (s) => {
    air = Math.max(air, s.craft.airTime);
    return COAST;
  });
  const combo = events.find((e) => e.kind === "combo");
  return { banked: combo?.kind === "combo" ? combo.points : 0, air };
}

describe("the air's rate", () => {
  it("is worth the quoted rate one knee into a flight, and rises from there", () => {
    const T = TUNING.tricks;
    expect(airPointsPerSecond(T.airKnee)).toBeCloseTo(T.airRate, 6);
    expect(airPointsPerSecond(0)).toBe(0);
    expect(airPointsPerSecond(2 * T.airKnee)).toBeGreaterThan(airPointsPerSecond(T.airKnee));
    expect(airPointsPerSecond(20)).toBeGreaterThan(4 * T.airRate);
  });

  it("rises, so a second of a long flight is worth more than a second of a short one", () => {
    for (const t of [0.5, 1, 2, 5, 10]) {
      expect(airPointsPerSecond(t * 2)).toBeGreaterThan(airPointsPerSecond(t));
    }
  });

  it("never runs away: twenty times the flight is under five times the rate", () => {
    expect(airPointsPerSecond(20)).toBeLessThan(5 * airPointsPerSecond(1));
  });
});

describe("a flight's purse", () => {
  it("pays nothing at all for a hop that is not air time", () => {
    // Dropped 1.2 m onto calm water: a real landing, and under the line a
    // flight starts counting at (`flight.airCounts`).
    const state = game();
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 15, height: 1.2 });
    ride(state, 4);
    expect(state.craft.airTime).toBe(0);
    expect(state.tricks.score).toBe(0);
  });

  it("grows faster than the flight does", () => {
    // Two flights, the second about twice as long as the first; its purse
    // is more than twice the first's, which is the whole shape of the
    // ladder — the top is worth disproportionately more than the bottom.
    const short = jump(4);
    const long = jump(9);
    expect(short.banked).toBeGreaterThan(0);
    expect(long.air).toBeGreaterThan(1.8 * short.air);
    expect(long.banked).toBeGreaterThan(2.2 * short.banked);
  });

  it("ticks while the hull is up rather than paying at the landing", () => {
    const state = game();
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 15, height: 1.5, vy: 9 });
    ride(state, 1.2);
    expect(state.craft.airborne).toBe(true);
    // Still in the air, nothing banked, and the combo is already worth
    // something — the number a readout is counting up.
    expect(state.tricks.base).toBeGreaterThan(0);
    expect(state.tricks.score).toBe(0);
    const mid = state.tricks.base;
    ride(state, 0.4);
    expect(state.tricks.base).toBeGreaterThan(mid);
  });
});

describe("a revolution", () => {
  /** A big ramp with the lean held back: the flight `flight_test` uses to
   * prove a backflip completes at all, ridden here for what it pays. */
  function flipRun(rampAngle: number, rampLength: number, seconds: number): GameState {
    const big = syntheticLevel({ windSpeed: 0, noSolids: true, rampAngle, rampLength });
    const state = createGame({ seed: 1, craft: "skiff", level: big, quiet: true });
    const ramp = big.course.gates.find((g) => g.kind === "air")!.ramp!;
    placeRun(state, { x: ramp.x - 40, z: ramp.z, heading: Math.PI / 2, speed: 20 });
    ride(state, seconds, (s) => ({
      steer: 0,
      throttle: 1,
      reverse: 0,
      lean: s.craft.airborne || s.craft.onRamp ? 1 : 0,
      crouch: 0,
      reset: false,
    }));
    return state;
  }

  it("is scored the moment it completes, in the air, and doubles the combo", () => {
    const big = syntheticLevel({ windSpeed: 0, noSolids: true, rampAngle: 0.5, rampLength: 10 });
    const state = createGame({ seed: 1, craft: "skiff", level: big, quiet: true });
    const ramp = big.course.gates.find((g) => g.kind === "air")!.ramp!;
    placeRun(state, { x: ramp.x - 40, z: ramp.z, heading: Math.PI / 2, speed: 20 });
    let aloft = false;
    const events = ride(state, 8, (s) => {
      const e = s.events.find((v) => v.kind === "trick");
      if (e) aloft = s.craft.airborne;
      return {
        steer: 0,
        throttle: 1,
        reverse: 0,
        lean: s.craft.airborne || s.craft.onRamp ? 1 : 0,
        crouch: 0,
        reset: false,
      };
    });
    const trick = events.find((e) => e.kind === "trick");
    expect(trick).toBeDefined();
    if (trick?.kind !== "trick") return;
    expect(trick.trick).toBe("backflip");
    expect(trick.spins).toBe(1);
    expect(trick.points).toBe(TUNING.tricks.flipPoints);
    // A single is ×2: the multiplier starts at 1 and the first revolution
    // is worth one step of it.
    expect(trick.mult).toBe(2);
    expect(aloft).toBe(true);
  });

  it("pays a combo worth more than the same flight flown flat", () => {
    const flipped = flipRun(0.5, 10, 8);
    const plain = (() => {
      const big = syntheticLevel({ windSpeed: 0, noSolids: true, rampAngle: 0.5, rampLength: 10 });
      const state = createGame({ seed: 1, craft: "skiff", level: big, quiet: true });
      const ramp = big.course.gates.find((g) => g.kind === "air")!.ramp!;
      placeRun(state, { x: ramp.x - 40, z: ramp.z, heading: Math.PI / 2, speed: 20 });
      ride(state, 8, () => ({
        steer: 0,
        throttle: 1,
        reverse: 0,
        lean: 0,
        crouch: 0,
        reset: false,
      }));
      return state;
    })();
    expect(flipped.tricks.score).toBeGreaterThan(2 * plain.tricks.score);
  });

  it("is worth more the second time round: a double is ×4, not ×3", () => {
    // The ladder as the model states it, checked on the state directly
    // rather than by finding a wave big enough to turn two — the second
    // revolution is worth two steps of multiplier and twice the base.
    const T = TUNING.tricks;
    const state = game();
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 15, height: 1.5, vy: 9 });
    // Spin the hull by hand at a rate that turns two full revolutions
    // inside the flight: nose-up is a negative body x rate.
    const events = ride(state, 2.2, (s) => {
      if (s.craft.airborne) s.craft.wx = -14;
      return COAST;
    });
    const tricks = events.filter((e) => e.kind === "trick");
    expect(tricks.length).toBeGreaterThanOrEqual(2);
    if (tricks[0]?.kind !== "trick" || tricks[1]?.kind !== "trick") return;
    expect(tricks[0].spins).toBe(1);
    expect(tricks[0].points).toBe(T.flipPoints);
    expect(tricks[0].mult).toBe(2);
    expect(tricks[1].spins).toBe(2);
    expect(tricks[1].points).toBe(2 * T.flipPoints);
    expect(tricks[1].mult).toBe(4);
  });

  it("does not accumulate out of chop: a hull pitching about turns nothing", () => {
    const sea = syntheticLevel({ windSpeed: 14, noSolids: true, depth: 20 });
    const state = createGame({ seed: 3, craft: "skiff", level: sea, quiet: true });
    placeRun(state, { x: 100, z: 260, heading: Math.PI / 2, speed: 18 });
    const events = ride(state, 30, () => ({
      steer: 0,
      throttle: 0.8,
      reverse: 0,
      lean: 0,
      crouch: 0,
      reset: false,
    }));
    expect(events.filter((e) => e.kind === "trick")).toHaveLength(0);
  });
});

describe("the combo", () => {
  it("banks the base times the multiplier once the link window runs out", () => {
    const state = game();
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 15, height: 1.5, vy: 8 });
    const events = ride(state, 6);
    const combo = events.find((e) => e.kind === "combo");
    expect(combo).toBeDefined();
    if (combo?.kind !== "combo") return;
    expect(combo.mult).toBe(1);
    expect(combo.points).toBe(combo.base * combo.mult);
    expect(state.tricks.score).toBe(combo.points);
    // ...and the combo is empty again, ready for the next one.
    expect(state.tricks.base).toBe(0);
    expect(state.tricks.mult).toBe(1);
  });

  it("stays open across a landing, so two flights inside the window are one combo", () => {
    const state = game();
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 15, height: 1.5, vy: 8 });
    // Up, down, and straight back up before the window is out.
    ride(state, 2, () => COAST);
    expect(state.craft.airborne).toBe(false);
    expect(state.tricks.link).toBeGreaterThan(0);
    const carried = state.tricks.base;
    expect(carried).toBeGreaterThan(0);
    state.craft.vy = 9;
    state.craft.y += 0.8;
    const events = ride(state, 6);
    expect(events.filter((e) => e.kind === "combo")).toHaveLength(1);
    const combo = events.find((e) => e.kind === "combo");
    if (combo?.kind !== "combo") return;
    expect(combo.base).toBeGreaterThan(carried);
  });

  it("is lost on a bail, and the run's banked score is not", () => {
    const state = game();
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 15, height: 1.5, vy: 8 });
    ride(state, 6);
    const banked = state.tricks.score;
    expect(banked).toBeGreaterThan(0);
    // A second flight, thrown away by going over the bars at the end of it:
    // launched with the nose already dropping, it comes down bow-first and
    // buries it, which is a `dive` and so a bail.
    //
    // A DIVE rather than a capsize, and it has to be: `capsize.after` = 1.5 s
    // is longer than the `tricks.linkWindow` = 1 s a combo stays open for
    // once the hull is down, so a hull rolled onto its back always banks
    // before it is declared over. The dive is the half of "over the bars"
    // that can actually reach an open combo.
    placeRun(state, {
      x: 100,
      z: 200,
      heading: Math.PI / 2,
      speed: 20,
      height: 1.5,
      vy: 10,
      pitchRate: -1.2,
    });
    ride(state, 1.4);
    expect(state.tricks.base).toBeGreaterThan(0);
    const events = ride(state, 12);
    const bailed = events.find((e) => e.kind === "bail");
    expect(bailed).toBeDefined();
    if (bailed?.kind === "bail") expect(bailed.lost).toBeGreaterThan(0);
    expect(state.tricks.score).toBe(banked);
    expect(state.tricks.base).toBe(0);
    expect(state.tricks.mult).toBe(1);
  });

  it("goes with the rider when he puts himself back at a gate", () => {
    const state = game();
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 15, height: 1.5, vy: 8 });
    ride(state, 1.4);
    expect(state.tricks.base).toBeGreaterThan(0);
    step(state, { ...COAST, reset: true });
    expect(state.events.some((e) => e.kind === "bail")).toBe(true);
    expect(state.tricks.base).toBe(0);
    expect(state.tricks.score).toBe(0);
  });
});
