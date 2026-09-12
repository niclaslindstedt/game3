// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The air over the water: a placed flight follows a ballistic arc and comes
// down with a `land`, a ramp at speed launches, a nose-down landing costs
// far more than a flat one, a big ramp with the lean held back completes a
// backflip, and the orientation algebra under all of it round-trips.
//
// The arcade landing assist has its own file (`assist_test.ts`). What is
// measured HERE is the model under it, so anything about an entry attitude
// is ridden with `assist: 0` and says so.
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
const FULL: CraftInput = { steer: 0, throttle: 1, reverse: 0, lean: 0, crouch: 0, reset: false };
const COAST: CraftInput = { steer: 0, throttle: 0, reverse: 0, lean: 0, crouch: 0, reset: false };

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

  it("a hop shorter than the counting line is not air time", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: FLAT, quiet: true });
    // Dropped 1.2 m onto calm water: clear of it for about 0.41 s, which is
    // a real landing — it slams, it splashes — and no time in the air.
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 15, height: 1.2 });
    const landings = ride(state, 4, () => COAST).filter((e) => e.kind === "land");
    expect(landings.length).toBeGreaterThan(0);
    for (const e of landings) {
      if (e.kind !== "land") continue;
      expect(e.airTime).toBeLessThan(TUNING.flight.airCounts);
      expect(e.record).toBe(false);
    }
    expect(state.progress.bestAir).toBe(0);
  });

  it("the longest flight of the run holds the record, and only it is marked", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: FLAT, quiet: true });
    const flown: { airTime: number; record: boolean }[] = [];
    // Four flights in one run, in this order: one that counts, a hop under
    // the line, a shorter flight that counts, and one that beats the lot.
    for (const [height, vy] of [
      [1.5, 3],
      [1.2, 0],
      [1.5, 1],
      [1.5, 9],
    ]) {
      placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 15, height, vy });
      for (const e of ride(state, 4, () => COAST)) {
        if (e.kind === "land") flown.push({ airTime: e.airTime, record: e.record });
      }
    }
    expect(flown.length).toBe(4);
    expect(flown.map((f) => f.record)).toEqual([true, false, false, true]);
    // The third flight counts as air time and still takes nothing: the run
    // has been up longer already.
    expect(flown[2].airTime).toBeGreaterThan(TUNING.flight.airCounts);
    expect(flown[2].airTime).toBeLessThan(flown[0].airTime);
    expect(state.progress.bestAir).toBeCloseTo(flown[3].airTime, 9);
    expect(flown[3].airTime).toBeGreaterThan(flown[0].airTime);
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

  /** The bare physics of an entry attitude — `assist: 0`, because the
   * arcade's hand is exactly what stops a nose-down landing from being a
   * dive and this is the model underneath it being measured. */
  function landing(pitch: number): { loss: number; dived: boolean } {
    const state = createGame({ seed: 1, craft: "skiff", level: FLAT, assist: 0, quiet: true });
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
    const nose = landing(-0.45);
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
      return {
        steer: 0,
        throttle: 1,
        reverse: 0,
        lean: c.airborne || c.onRamp ? 1 : 0,
        crouch: 0,
        reset: false,
      };
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
      return { steer: 0, throttle: 1, reverse: 0, lean, crouch: 0, reset: false };
    });
    expect(events.some((e) => e.kind === "launch")).toBe(true);
    expect(events.some((e) => e.kind === "land")).toBe(true);
    expect(Math.abs(state.craft.roll)).toBeLessThan(0.3);
    expect(state.craft.speed).toBeGreaterThan(10);
    expect(state.craft.airborne).toBe(false);
  });

  /** A ramp the GENERATOR actually builds (R8: 15–22°, 8–10 m), ridden the
   * way a rider rides one — the lean held back up the deck, then worked
   * from the lip. `key` is the keyboard's own lean ramp
   * (`KEY_LEAN_ATTACK` 5 / `KEY_LEAN_RELEASE` 8), because the pump is read
   * off the SHAPE of that axis and a raw square wave is not one. */
  function ramped(value: number, target: number): number {
    return value + (target - value) * Math.min(1, (target === 0 ? 8 : 5) * TUNING.dt);
  }

  function jump(
    craft: "skiff" | "marlin" | "otter" | "dart",
    tap: boolean,
  ): { flips: number; air: number } {
    const level = syntheticLevel({
      windSpeed: 0,
      noSolids: true,
      rampAngle: (18 * Math.PI) / 180,
      rampLength: 9,
    });
    const state = createGame({ seed: 1, craft, level, quiet: true });
    const r = rampOf(level);
    placeRun(state, { x: r.x - 60, z: r.z, heading: Math.PI / 2, speed: 24 });
    // THE LONGEST FLIGHT of the run, not the first: a hull crossing a deck
    // lifts a probe clear for a fifth of a second on the way, which is a
    // launch and a landing the engine reports and not the jump.
    let rotation = 0;
    let air = 0;
    let best = { flips: 0, air: 0 };
    let lean = 0;
    let aloft = 0;
    ride(state, 8, (s) => {
      const c = s.craft;
      if (c.airborne) {
        rotation += -c.wx * TUNING.dt;
        air = Math.max(air, c.airTime);
        aloft += TUNING.dt;
      } else {
        if (air > best.air) best = { flips: rotation / (2 * Math.PI), air };
        rotation = 0;
        air = 0;
      }
      // Hold it back up the deck; from the lip on, either keep holding or
      // work the key at five taps a second.
      const back = c.onRamp || !tap ? c.airborne || c.onRamp : c.airborne && aloft % 0.2 < 0.1;
      lean = ramped(lean, back ? 1 : 0);
      return { steer: 0, throttle: 1, reverse: 0, lean, crouch: 0, reset: false };
    });
    return air > best.air ? { flips: rotation / (2 * Math.PI), air } : best;
  }

  it("a REGULAR ramp comes round on the taps where a hold alone will not", () => {
    // The tourer is the hull that cannot flip on a hold — 0.4 of a turn off
    // an 18° ramp with the lean pinned back — and the pump is what puts the
    // trick within its reach. Measured across the roster in the PR.
    const held = jump("otter", false);
    const pumped = jump("otter", true);
    expect(held.air).toBeGreaterThan(1.4);
    expect(held.flips).toBeLessThan(0.7);
    expect(pumped.flips).toBeGreaterThan(1);
    // ...and the hang is the ramp's, not the rider's: the taps buy rotation
    // and nothing else.
    expect(Math.abs(pumped.air - held.air)).toBeLessThan(0.25);
  });

  it("the archetypes cost different numbers of taps", () => {
    // The stand-up is over on its first haul and the tourer taps its way
    // there, which is `riderAuthority / I_x` and no knob of their own.
    const flips = (["dart", "skiff", "marlin", "otter"] as const).map((id) => jump(id, true).flips);
    expect(flips[0]).toBeGreaterThan(flips[3] * 1.5);
    for (const f of flips) expect(f).toBeGreaterThan(1);
  });

  it("a hold earns one yank and a mash earns one a tap", () => {
    const level = syntheticLevel({ windSpeed: 0, noSolids: true });
    function yanks(key: (t: number) => number): number {
      const state = createGame({ seed: 1, craft: "skiff", level, quiet: true });
      placeRun(state, { x: 200, z: 160, heading: 0, speed: 20, height: 14, vy: 6 });
      let lean = 0;
      let was = false;
      let n = 0;
      let t = 0;
      ride(state, 3, (s) => {
        lean = ramped(lean, key(t));
        t += TUNING.dt;
        // A stroke is `pumpRising` turning true — counted here rather than
        // off `yank`, so that the strokes the budget has nothing left for
        // still count as strokes.
        if (s.craft.pumpRising && !was) n++;
        was = s.craft.pumpRising;
        return { steer: 0, throttle: 0, reverse: 0, lean, crouch: 0, reset: false };
      });
      return n;
    }
    // A key that never comes back up is one stroke however long it is held.
    expect(yanks(() => 1)).toBe(1);
    // ...and one worked at five a second is one stroke each.
    expect(yanks((t) => (t % 0.2 < 0.1 ? 1 : 0))).toBeGreaterThan(6);
    // Nothing at all for a rider who is not asking.
    expect(yanks(() => 0)).toBe(0);
  });

  it("a yank waits for the flight and is lost if the rider lets go first", () => {
    // Asked for with the hull in the water: it lands when the hull is
    // flying, not before, and not at all if the bars come back first.
    function rotationOf(letGoOnTheDeck: boolean): number {
      const level = syntheticLevel({
        windSpeed: 0,
        noSolids: true,
        rampAngle: (18 * Math.PI) / 180,
        rampLength: 9,
      });
      const state = createGame({ seed: 1, craft: "skiff", level, quiet: true, assist: 0 });
      const r = rampOf(level);
      placeRun(state, { x: r.x - 60, z: r.z, heading: Math.PI / 2, speed: 24 });
      let lean = 0;
      let rotation = 0;
      ride(state, 6, (s) => {
        const c = s.craft;
        const ask = letGoOnTheDeck ? c.onRamp && !c.airborne : c.onRamp || c.airborne;
        lean = ramped(lean, ask ? 1 : 0);
        if (c.airborne) rotation += -c.wx * TUNING.dt;
        return { steer: 0, throttle: 1, reverse: 0, lean, crouch: 0, reset: false };
      });
      return rotation;
    }
    // Both ride the same lip; only the one still holding at `minAir` is
    // given the haul.
    expect(rotationOf(true)).toBeLessThan(rotationOf(false) - 1);
  });

  it("in the air the throttle does nothing and the steer rolls", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: FLAT, quiet: true });
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 15, height: 8, vy: 4 });
    const v0 = Math.hypot(state.craft.vx, state.craft.vz);
    for (let i = 0; i < 40; i++)
      step(state, { steer: 1, throttle: 1, reverse: 0, lean: 0, crouch: 0, reset: false });
    expect(state.craft.airborne).toBe(true);
    // No thrust: horizontal speed can only have fallen (air drag).
    expect(Math.hypot(state.craft.vx, state.craft.vz)).toBeLessThanOrEqual(v0);
    expect(state.craft.roll).toBeGreaterThan(0.02);
  });
});
