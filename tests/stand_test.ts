// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE STAND-UP: the rider off the seat and back over the transom, standing
// the craft on its tail. Held here are the three things that make it a
// trick rather than a bug — it takes a deliberate hold to reach, the ride's
// own lean-backs never reach it, and overdoing it puts the rider over the
// back — plus the null case every arcade hand owes: with the stand switched
// out, the hull is the hull it was.
import { describe, expect, it } from "vitest";

import { TUNING, createGame, placeRun, step, type CraftInput, type GameState } from "@engine";

import { syntheticLevel } from "./support/synthetic.ts";

const FLAT = syntheticLevel({ windSpeed: 0, noSolids: true, seaward: 1200 });
const HZ = TUNING.physicsHz;
const DEG = Math.PI / 180;

const NEUTRAL: CraftInput = { steer: 0, throttle: 0, reverse: 0, lean: 0, crouch: 0, reset: false };

/** A craft stood at rest on the flat, ready to be ridden. */
function atRest(craft = "skiff"): GameState {
  const state = createGame({
    seed: 1,
    craft: craft as "skiff",
    level: FLAT,
    quiet: true,
    assist: 0,
  });
  placeRun(state, { x: -50, z: 400, heading: Math.PI / 2 });
  return state;
}

/** Ride `seconds` on one input, reporting what the hull did. */
function ride(
  state: GameState,
  input: Partial<CraftInput>,
  seconds: number,
): { maxPitch: number; maxStand: number; stand: number; capsizes: number } {
  const full = { ...NEUTRAL, ...input };
  let maxPitch = -Infinity;
  let maxStand = 0;
  let capsizes = 0;
  for (let i = 0; i < Math.round(seconds * HZ); i++) {
    step(state, full);
    for (const e of state.events) if (e.kind === "capsize") capsizes++;
    maxPitch = Math.max(maxPitch, state.craft.pitch);
    maxStand = Math.max(maxStand, state.craft.stand);
  }
  return { maxPitch, maxStand, stand: state.craft.stand, capsizes };
}

describe("the stand-up", () => {
  it("rears the hull onto its tail when the lean is held back on the throttle", () => {
    const state = atRest();
    // Taken over the whole ride, not at the end of it: a rider who stands it
    // up rides it round, throws it clear of the water and comes down again,
    // and the stand folds away every time the hull leaves him.
    const { maxPitch, maxStand } = ride(state, { throttle: 1, lean: 1 }, 4);
    // The rider gets up...
    expect(maxStand).toBeGreaterThan(0.8);
    // ...and the nose goes far past any trim a hull on the plane ever runs at.
    expect(maxPitch).toBeGreaterThan(45 * DEG);
  });

  it("takes a HELD ask: a lean-back shorter than the dwell never starts it", () => {
    const state = atRest();
    const full = { ...NEUTRAL, throttle: 1, lean: 1 };
    // Lean back in bursts, each one comfortably under the dwell, the way the
    // ride itself uses the control — up a ramp, through a head sea.
    const burst = Math.round(TUNING.stand.dwell * 0.6 * HZ);
    let maxStand = 0;
    for (let round = 0; round < 12; round++) {
      for (let i = 0; i < burst; i++) {
        step(state, full);
        maxStand = Math.max(maxStand, state.craft.stand);
      }
      for (let i = 0; i < burst; i++) {
        step(state, { ...full, lean: 0 });
        maxStand = Math.max(maxStand, state.craft.stand);
      }
    }
    expect(maxStand).toBe(0);
  });

  it("needs the throttle too — a lean held back with the jet shut stays seated", () => {
    const state = atRest();
    const { stand } = ride(state, { throttle: TUNING.stand.throttle * 0.5, lean: 1 }, 6);
    expect(stand).toBe(0);
  });

  it("stays up through the throttle work that balances it", () => {
    const state = atRest();
    // Get him up...
    ride(state, { throttle: 1, lean: 1 }, TUNING.stand.dwell + 0.5);
    expect(state.craft.stand).toBeGreaterThan(0.5);
    // ...then ease the throttle the way a rider balancing it would. The bar
    // to STAY up is lower than the bar to commit, so a correction must not
    // drop him back onto the seat.
    const eased = TUNING.stand.throttle * TUNING.stand.keep + 0.01;
    for (let i = 0; i < Math.round(0.4 * HZ); i++) {
      step(state, { ...NEUTRAL, throttle: eased, lean: 1 });
    }
    expect(state.craft.stand).toBeGreaterThan(0.5);
  });

  it("puts the rider over the back when it is overdone", () => {
    const state = atRest();
    // Everything held, nothing eased: the jet's couple does not shrink as
    // the hull comes upright and the rider's weight does, so it goes over.
    const { capsizes } = ride(state, { throttle: 1, lean: 1 }, 12);
    expect(capsizes).toBeGreaterThan(0);
  });

  it("cannot be started on a hull that is not under him", () => {
    // Thrown clear of the water there is nothing to stand up against, so
    // the ask never reaches the body however long it is held.
    const state = createGame({
      seed: 1,
      craft: "skiff",
      level: FLAT,
      quiet: true,
      assist: 0,
    });
    placeRun(state, { x: -50, z: 400, heading: Math.PI / 2, speed: 18, height: 14 });
    let maxStand = 0;
    for (let i = 0; i < Math.round((TUNING.stand.dwell + 0.4) * HZ); i++) {
      step(state, { ...NEUTRAL, throttle: 1, lean: 1 });
      if (!state.craft.airborne) break;
      maxStand = Math.max(maxStand, state.craft.stand);
    }
    expect(maxStand).toBe(0);
  });

  it("changes nothing about a hull that is not asking for it", () => {
    // The null case: ridden with the lean neutral, the stand never leaves 0
    // and the run is the run it always was.
    const state = atRest();
    for (let i = 0; i < Math.round(8 * HZ); i++) {
      step(state, { ...NEUTRAL, throttle: 1 });
      expect(state.craft.stand).toBe(0);
      expect(state.craft.standHold).toBe(0);
    }
    // ...and a hull on the plane with the lean neutral sits at a planing
    // trim, not a reared one.
    expect(state.craft.pitch).toBeLessThan(12 * DEG);
  });

  it("is reset with the run", () => {
    const state = atRest();
    ride(state, { throttle: 1, lean: 1 }, TUNING.stand.dwell + 0.5);
    expect(state.craft.stand).toBeGreaterThan(0);
    step(state, { ...NEUTRAL, reset: true });
    expect(state.craft.stand).toBe(0);
    expect(state.craft.standHold).toBe(0);
  });
});

describe("the planing surface past its band", () => {
  it("is gone by the trim a reared hull reaches, and whole below it", () => {
    const { fadeFrom, fadeGone, trimMax } = TUNING.planing;
    // The fade starts above Savitsky's band rather than at it: a ramp and a
    // landing run past the data and do still plane.
    expect(fadeFrom).toBeGreaterThan(trimMax);
    expect(fadeGone).toBeGreaterThan(fadeFrom);
    // ...and it is gone before the hull is on its tail, or there would be a
    // bottom pointing at the sky carrying the craft's weight.
    expect(fadeGone).toBeLessThan(90);
  });
});
