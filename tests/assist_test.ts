// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARCADE'S HAND (`engine/game/flight.ts`, `landingAssist`): the last
// moment before the water, and what it is allowed to do with it.
//
// The whole promise is two-sided and both sides are held here. A flight
// that was going to end badly — thrown sideways off a lip, wound nose-up
// by the plate over the hang — is turned toward the attitude it ought to
// land at and the rider keeps the ride. A flight that was going to be
// fine is not touched AT ALL: a clean landing and a backflip that is
// coming round both ride out with the assist adding nothing, which is
// what keeps the air a decision rather than a cutscene.
//
// Every case here is staged with `placeRun` on the synthetic level, so
// what is measured is the assist and not a generator.
import { describe, expect, it } from "vitest";

import {
  TUNING,
  createGame,
  fromEuler,
  landingAssist,
  placeRun,
  step,
  timeToWater,
  type CraftId,
  type CraftInput,
  type GameEvent,
  type GameState,
} from "@engine";

import { syntheticLevel } from "./support/synthetic.ts";

const FLAT = syntheticLevel({ windSpeed: 0, noSolids: true });
const COAST: CraftInput = { steer: 0, throttle: 0, reverse: 0, lean: 0, reset: false };
const CRUISE: CraftInput = { steer: 0, throttle: 0.6, reverse: 0, lean: 0, reset: false };

type Flight = {
  /** The attitude the hull actually arrived at, rad. */
  pitch: number;
  roll: number;
  /** The speed at the instant of entry, and the worst of it over the
   * second that follows — which is where a dive is actually paid for. */
  speed: number;
  after: number;
  dived: boolean;
  capsized: boolean;
  landed: boolean;
};

/** Throw a craft off a lip at an attitude and let it come down with the
 * rider doing nothing, which is the case the assist exists for. */
function toss(
  opts: {
    craft?: CraftId;
    assist?: number;
    pitch?: number;
    roll?: number;
    pitchRate?: number;
    speed?: number;
    input?: CraftInput;
  } = {},
): Flight {
  const state = createGame({
    seed: 1,
    craft: opts.craft ?? "skiff",
    level: FLAT,
    assist: opts.assist,
    quiet: true,
  });
  placeRun(state, {
    x: 200,
    z: 160,
    heading: 0,
    speed: opts.speed ?? 20,
    height: 3.2,
    vy: 5.5,
    pitch: opts.pitch ?? 0,
    roll: opts.roll ?? 0,
    pitchRate: opts.pitchRate ?? 0,
  });
  const c = state.craft;
  const out: Flight = {
    pitch: 0,
    roll: 0,
    speed: 0,
    after: Infinity,
    dived: false,
    capsized: false,
    landed: false,
  };
  let landedAt = -1;
  let t = 0;
  for (let i = 0; i < 6 * TUNING.physicsHz; i++) {
    const wasAir = c.airborne;
    step(state, opts.input ?? CRUISE);
    t += TUNING.dt;
    for (const e of state.events) {
      if (e.kind === "dive") out.dived = true;
      if (e.kind === "capsize") out.capsized = true;
    }
    if (wasAir && !c.airborne && !out.landed) {
      out.landed = true;
      landedAt = t;
      out.pitch = c.pitch;
      out.roll = c.roll;
      out.speed = c.speed;
    }
    if (landedAt > 0 && t - landedAt <= 1) out.after = Math.min(out.after, c.speed);
  }
  return out;
}

describe("the ballistic clock", () => {
  it("counts a fall to the water and nothing once it is in", () => {
    // Dropped from 5 m at rest: √(2·5/9.81) ≈ 1.01 s.
    expect(timeToWater(5, 0)).toBeCloseTo(Math.sqrt((2 * 5) / 9.81), 3);
    // Already wet, and a hull driven under, are both out of time.
    expect(timeToWater(0, -3)).toBe(0);
    expect(timeToWater(-0.4, -3)).toBe(0);
  });

  it("gives a climbing hull the whole arc, not the distance down", () => {
    const up = timeToWater(3, 6);
    expect(up).toBeGreaterThan(timeToWater(3, 0));
    // The climb is spent and then the fall: 2·vy/g to come back through
    // the height it started at, now 6 m/s DOWN, and the fall from there.
    expect(up).toBeCloseTo((2 * 6) / 9.81 + timeToWater(3, -6), 9);
  });
});

describe("the arcade's hand", () => {
  it("lands a hull thrown on its side on its bottom", () => {
    // Sixty-three degrees of bank off the lip. The bare hull arrives
    // still on its side; the caught one arrives on its bottom.
    const bare = toss({ roll: 1.1, assist: 0 });
    const caught = toss({ roll: 1.1, assist: 1 });
    expect(bare.landed).toBe(true);
    expect(caught.landed).toBe(true);
    expect(Math.abs(bare.roll)).toBeGreaterThan(0.8);
    expect(Math.abs(caught.roll)).toBeLessThan(Math.abs(bare.roll) / 2);
  });

  it("saves the swim from a launch that goes past vertical", () => {
    // Past ninety degrees the bare hull arrives inverted and stays there
    // — a PWC does not self-right, so that is the rider in the water.
    const bare = toss({ roll: 1.75, assist: 0 });
    const caught = toss({ roll: 1.75, assist: 1 });
    expect(bare.capsized).toBe(true);
    expect(caught.capsized).toBe(false);
    expect(Math.abs(caught.roll)).toBeLessThan(0.7);
  });

  it("turns a nose-down flight into a landing instead of a dive", () => {
    const bare = toss({ pitch: -0.5, assist: 0 });
    const caught = toss({ pitch: -0.5, assist: 1 });
    expect(bare.dived).toBe(true);
    expect(caught.dived).toBe(false);
    // Twenty-odd degrees of the entry attitude, taken out of it on the
    // way down: the plate holds a nose-down hull nose-down, so this is a
    // correction against a moment that is helping the water, not with it.
    expect(caught.pitch - bare.pitch).toBeGreaterThan(0.35);
  });

  it("keeps the speed a bad landing would have taken", () => {
    // What a dive costs is not read at the instant of entry — both hulls
    // are still doing 20 m/s there — but over the second after it, which
    // is the hull being dragged to a stop by its own buried bow.
    const bare = toss({ pitch: -0.5, assist: 0 });
    const caught = toss({ pitch: -0.5, assist: 1 });
    expect(caught.after).toBeGreaterThan(bare.after + 5);
  });

  it("catches every craft alike, the gain being an acceleration and not a torque", () => {
    // Pitch inertia runs 165 to 490 kg·m² across the roster, so a hand
    // quoted in N·m would catch the dart three times as hard as the otter.
    for (const craft of ["skiff", "marlin", "otter", "dart"] as const) {
      const bare = toss({ craft, roll: 1.1, assist: 0 });
      const caught = toss({ craft, roll: 1.1, assist: 1 });
      expect(Math.abs(caught.roll), craft).toBeLessThan(Math.abs(bare.roll) / 2);
      expect(caught.capsized, craft).toBe(false);
    }
  });

  it("is a dial, and half of it is half the correction", () => {
    const rolls = [0, 0.5, 1].map((assist) => Math.abs(toss({ roll: 1.1, assist }).roll));
    expect(rolls[0]).toBeGreaterThan(rolls[1]);
    expect(rolls[1]).toBeGreaterThan(rolls[2]);
  });
});

describe("what the hand does not touch", () => {
  /** Two runs of the same flight, one dialled off, compared step by step:
   * an assist that never engaged leaves the trajectories identical. */
  function divergence(opts: Parameters<typeof toss>[0] & { height?: number; vy?: number }): number {
    const make = (assist: number) => {
      const s = createGame({ seed: 1, craft: "skiff", level: FLAT, assist, quiet: true });
      placeRun(s, {
        x: 200,
        z: 160,
        heading: 0,
        speed: opts.speed ?? 20,
        height: opts.height ?? 3.2,
        vy: opts.vy ?? 5.5,
        pitch: opts.pitch ?? 0,
        roll: opts.roll ?? 0,
        pitchRate: opts.pitchRate ?? 0,
      });
      return s;
    };
    const off = make(0);
    const on = make(1);
    let worst = 0;
    for (let i = 0; i < 1.2 * TUNING.physicsHz; i++) {
      step(off, opts.input ?? COAST);
      step(on, opts.input ?? COAST);
      if (!off.craft.airborne) break;
      worst = Math.max(worst, Math.abs(off.craft.pitch - on.craft.pitch));
      worst = Math.max(worst, Math.abs(off.craft.roll - on.craft.roll));
    }
    return worst;
  }

  /** The mechanism itself, 0.6 m over the water and falling at 4 m/s —
   * 0.13 s of flight left, well inside the window — half a second into a
   * real flight, with the skiff's inertia. `nose` is the nose-up rate,
   * which is −wx. */
  function torqueAt(pitch: number, nose: number, roll = 0): [number, number, number] {
    const out = { fx: 0, fy: 0, fz: 0, tx: 0, ty: 0, tz: 0 };
    landingAssist(fromEuler(0, pitch, roll), -nose, 0, 0, 228, 225, 60, 0.5, 0.6, -4, 0, 1, out);
    return [out.tx, out.ty, out.tz];
  }

  it("waits for a real flight: a chop hop is not a jump", () => {
    // The same badly-pointed hull, a hop old instead of a flight old.
    const out = { fx: 0, fy: 0, fz: 0, tx: 0, ty: 0, tz: 0 };
    const hop = TUNING.flight.minAir / 2;
    landingAssist(fromEuler(0, -0.4, 0), 0, 0, 0, 228, 225, 60, hop, 0.6, -4, 0, 1, out);
    expect([out.tx, out.ty, out.tz]).toEqual([0, 0, 0]);
    expect(torqueAt(-0.4, 0)[0]).toBeLessThan(-100);
  });

  it("adds no torque at all to a hull pointed at a good landing", () => {
    // The band is `landPitch` ± `pitchTolerance`: dead level, a touch of
    // bow lift, and either of them turning slowly enough to still arrive
    // inside it all come back as exactly nothing.
    for (const [pitch, nose] of [
      [0, 0],
      [0.06, 0],
      [0.12, 0],
      [0, 0.5],
      [0.1, -0.3],
    ]) {
      expect(torqueAt(pitch, nose), `pitch ${pitch} nose-up rate ${nose}`).toEqual([0, 0, 0]);
    }
  });

  it("...and does fire on one that is not, so the silence above means something", () => {
    // A hull arriving nose-down is pitched UP, which in right-handed body
    // axes is a negative x torque; one arriving on its right side is
    // rolled back left, a positive z torque.
    expect(torqueAt(-0.4, 0)[0]).toBeLessThan(-100);
    expect(torqueAt(0, 0, 0.8)[2]).toBeGreaterThan(100);
    // Turning fast enough to overshoot the band counts as arriving badly
    // even from a good attitude right now — the prediction is the test.
    expect(torqueAt(0.06, 4)[0]).toBeGreaterThan(100);
  });

  it("adds nothing a flight can feel while its prediction stays in the band", () => {
    // A low hop, level, over calm water: the plate never winds it far
    // enough out of the band to be caught, so the two runs stay bit-identical.
    expect(divergence({ pitch: 0.05, roll: 0, speed: 8, height: 0.8, vy: 2 })).toBeLessThan(1e-9);
  });

  it("leaves the whole hang above the window to the rider", () => {
    // A flight thrown badly is corrected in the end, but the first part
    // of the hang — everything more than `assist.window` from the water —
    // is untouched, so the rider owns the air until the approach.
    const off = createGame({ seed: 1, craft: "skiff", level: FLAT, assist: 0, quiet: true });
    const on = createGame({ seed: 1, craft: "skiff", level: FLAT, assist: 1, quiet: true });
    for (const s of [off, on]) {
      placeRun(s, { x: 200, z: 160, heading: 0, speed: 20, height: 8, vy: 9, roll: 1.1 });
    }
    let apart = 0;
    // The arc from 8 m at 9 m/s up is over 2.7 s; a second of it is well
    // clear of the window.
    for (let i = 0; i < 1 * TUNING.physicsHz; i++) {
      step(off, COAST);
      step(on, COAST);
      apart = Math.max(apart, Math.abs(off.craft.roll - on.craft.roll));
    }
    expect(off.craft.airborne).toBe(true);
    expect(apart).toBeLessThan(1e-9);
  });

  it("stands aside for a rider working the bars, either way he holds them", () => {
    // The air is the rider's first: a lean held is a rider flying it, and
    // what he gets is the bare physics — nose stuffed on purpose here,
    // a flip wound round in the case below. The same flight left alone
    // (`lean: 0`) is caught, so this is the input doing it.
    const held = { ...COAST, lean: -1 };
    expect(toss({ pitch: -0.4, assist: 1, input: held }).pitch).toBeCloseTo(
      toss({ pitch: -0.4, assist: 0, input: held }).pitch,
      9,
    );
    const alone = toss({ pitch: -0.4, assist: 1, input: COAST });
    expect(alone.pitch).toBeGreaterThan(toss({ pitch: -0.4, assist: 0, input: COAST }).pitch + 0.3);
  });
});

describe("the backflip", () => {
  /** The big ramp `flight_test` flips off, ridden with the lean held back
   * for the whole flight. */
  function flip(assist: number): { rotation: number; air: number; events: GameEvent[] } {
    const big = syntheticLevel({ windSpeed: 0, noSolids: true, rampAngle: 0.5, rampLength: 10 });
    const state: GameState = createGame({
      seed: 1,
      craft: "skiff",
      level: big,
      assist,
      quiet: true,
    });
    const ramp = big.course.gates.find((g) => g.kind === "air")!.ramp!;
    placeRun(state, { x: ramp.x - 40, z: ramp.z, heading: Math.PI / 2, speed: 20 });
    const events: GameEvent[] = [];
    let rotation = 0;
    let air = 0;
    for (let i = 0; i < 8 * TUNING.physicsHz; i++) {
      const c = state.craft;
      // Nose-up pitch rate is −wx; summed while aloft it is how far over
      // the hull has gone.
      if (c.airborne) {
        rotation += -c.wx * TUNING.dt;
        air = Math.max(air, c.airTime);
      }
      step(state, {
        steer: 0,
        throttle: 1,
        reverse: 0,
        lean: c.airborne || c.onRamp ? 1 : 0,
        reset: false,
      });
      events.push(...state.events);
    }
    return { rotation, air, events };
  }

  it("still completes with the hand on", () => {
    const caught = flip(1);
    expect(caught.air).toBeGreaterThan(1.5);
    expect(caught.rotation).toBeGreaterThan(2 * Math.PI);
  });

  it("is not touched at all: a flip is the lean held, and a lean held is the rider flying", () => {
    // The assertion that would fail if the hand read the ROTATION rather
    // than the rider: a hull half way round is genuinely predicted to
    // land on its head, and an assist that believed its own prediction
    // would unwind the flip into the water.
    const bare = flip(0);
    const caught = flip(1);
    expect(caught.rotation).toBeCloseTo(bare.rotation, 9);
  });
});
