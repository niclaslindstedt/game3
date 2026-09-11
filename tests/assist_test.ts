// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARCADE'S HAND (`engine/game/assist.ts`): the two moments it is
// allowed to touch — the last of a flight (`landingAssist`) and the run
// up a ramp's deck before it (`rampAssist`) — and what it may do with
// each.
//
// The whole promise is two-sided and both sides are held here, for both
// hands. A ride that was going to end badly — a flight thrown sideways
// off a lip, a hull skidding off the flank of a four-metre deck — is
// turned toward the one it ought to have and the rider keeps it. A ride
// that was going to be fine is not touched AT ALL: a clean landing, a
// backflip coming round and a jump lined up straight all ride out with
// the assist adding nothing, which is what keeps the air a decision
// rather than a cutscene and a ramp a ramp rather than a gutter.
//
// Every case here is staged with `placeRun` on the synthetic level, so
// what is measured is the assist and not a generator.
import { describe, expect, it } from "vitest";

import {
  TUNING,
  createGame,
  fromEuler,
  landingAssist,
  onRampDeck,
  placeRun,
  rampAssist,
  step,
  timeToWater,
  type CraftId,
  type CraftInput,
  type GameEvent,
  type GameState,
} from "@engine";

import { syntheticLevel } from "./support/synthetic.ts";

const FLAT = syntheticLevel({ windSpeed: 0, noSolids: true });
const COAST: CraftInput = { steer: 0, throttle: 0, reverse: 0, lean: 0, crouch: 0, reset: false };
const CRUISE: CraftInput = {
  steer: 0,
  throttle: 0.6,
  reverse: 0,
  lean: 0,
  crouch: 0,
  reset: false,
};

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
    landingAssist(
      fromEuler(0, pitch, roll),
      -nose,
      0,
      0,
      228,
      225,
      60,
      0.5,
      0.6,
      -4,
      0,
      1,
      TUNING.assist.air.window,
      out,
    );
    return [out.tx, out.ty, out.tz];
  }

  it("arrives when the WINDOW says, which is the difficulty ladder's other dial", () => {
    // The same badly-pointed hull at the same moment, with only the window
    // moved: 0.13 s of flight left is inside the shipped 0.75 s and outside
    // a hard rung's, so a short window hands the flight back to the rider
    // without softening the spring at all.
    const out = { fx: 0, fy: 0, fz: 0, tx: 0, ty: 0, tz: 0 };
    const at = (window: number): number => {
      landingAssist(fromEuler(0, -0.4, 0), 0, 0, 0, 228, 225, 60, 0.5, 0.6, -4, 0, 1, window, out);
      return out.tx;
    };
    expect(at(TUNING.assist.air.window)).toBeLessThan(-100);
    expect(at(0.1)).toBe(0);
    // ...and the ladder every rung of a difficulty setting comes from is
    // ordered, hardest first, with the shipped default somewhere inside it.
    const band = TUNING.assist.band;
    for (let i = 1; i < band.length; i++) {
      expect(band[i].strength, band[i].id).toBeGreaterThan(band[i - 1].strength);
      expect(band[i].window, band[i].id).toBeGreaterThan(band[i - 1].window);
      // ...and the ramp's hand comes down the same ladder, never rising
      // as the rung gets harder.
      expect(band[i].ramp, band[i].id).toBeGreaterThan(band[i - 1].ramp);
    }
    expect(band.some((r) => r.strength === TUNING.assist.air.strength)).toBe(true);
    expect(band.some((r) => r.ramp === TUNING.assist.ramp.strength)).toBe(true);
  });

  it("waits for a real flight: a chop hop is not a jump", () => {
    // The same badly-pointed hull, a hop old instead of a flight old.
    const out = { fx: 0, fy: 0, fz: 0, tx: 0, ty: 0, tz: 0 };
    const hop = TUNING.flight.minAir / 2;
    landingAssist(
      fromEuler(0, -0.4, 0),
      0,
      0,
      0,
      228,
      225,
      60,
      hop,
      0.6,
      -4,
      0,
      1,
      TUNING.assist.air.window,
      out,
    );
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
        crouch: 0,
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

// THE RAMP'S HAND. A deck with no keel in the water under it (R8's own
// width, which R33 made a dial and this bench reads off the level):
// whatever sideways way a hull climbs aboard with is the way it leaves,
// and the jump is lost to a line the rider never saw he had not made.
// The two sides here are the same two the air's hand is held to — it does
// something when the hull is on its way off the side, and it does exactly
// NOTHING when the hull is tracking straight up the deck, which is what
// keeps a ramp from reading as a gutter that rolls the craft to its
// middle.
describe("the ramp's hand", () => {
  const RAMP = FLAT.course.gates.find((g) => g.kind === "air")!.ramp!;
  const HALF = RAMP.width / 2;
  // A hair inside the flank, so that a case about the deck's very edge is
  // ON the deck rather than a rounding error off it.
  const EDGE = HALF * (1 - 1e-9);
  // The deck's own axes in the plan, the pair `onRampDeck` measures in:
  // `along` is up the ramp, `across` is ninety degrees clockwise of it.
  const SH = Math.sin(RAMP.heading);
  const CH = Math.cos(RAMP.heading);
  const deckX = (along: number, across: number) => RAMP.x + SH * along + CH * across;
  const deckZ = (along: number, across: number) => RAMP.z + CH * along - SH * across;

  /** The hand at a place on the deck, as the craft would feel it: the
   * across acceleration, m/s², and the yaw torque, for a skiff-sized hull
   * (mass 300 kg, yaw inertia 225 kg·m²). */
  function hand(
    opts: {
      across?: number;
      vAcross?: number;
      vAlong?: number;
      yaw?: number;
      yawRate?: number;
      steer?: number;
      strength?: number;
    } = {},
  ): { lateral: number; ty: number } {
    const out = { fx: 0, fy: 0, fz: 0, tx: 0, ty: 0, tz: 0 };
    const vAlong = opts.vAlong ?? 12;
    const vAcross = opts.vAcross ?? 0;
    const across = opts.across ?? 0;
    rampAssist(
      RAMP,
      fromEuler(RAMP.heading + (opts.yaw ?? 0), RAMP.angle, 0),
      deckX(4, across),
      deckZ(4, across),
      SH * vAlong + CH * vAcross,
      CH * vAlong - SH * vAcross,
      0,
      opts.yawRate ?? 0,
      0,
      300,
      225,
      opts.steer ?? 0,
      opts.strength ?? 1,
      out,
    );
    return { lateral: (out.fx * CH - out.fz * SH) / 300, ty: out.ty };
  }

  /** Nothing at all, to the last bit a float carries. */
  function feelsNothing(felt: { lateral: number; ty: number }, why: string): void {
    expect(felt.lateral, why).toBeCloseTo(0, 12);
    expect(felt.ty, why).toBeCloseTo(0, 12);
  }

  it("adds nothing at all to a hull tracking straight up the deck", () => {
    // Anywhere inside `free` of the half-width, at any pace, with the bow
    // on the axis: the deck is flat and the hand is not there.
    for (const across of [0, HALF * 0.2, -HALF * 0.39]) {
      feelsNothing(hand({ across }), `across ${across.toFixed(2)} m`);
    }
  });

  it("...and does hold a hull that is sliding off, so the silence means something", () => {
    // The slide damped — a hull drifting toward the deck's edge feels a
    // force against the drift wherever it is, the centreline included...
    expect(hand({ vAcross: 1.5 }).lateral).toBeLessThan(-1);
    expect(hand({ vAcross: -1.5 }).lateral).toBeGreaterThan(1);
    // ...and past the free band, the camber, growing to `centre` at the
    // very edge and pointing back toward the middle.
    const mid = hand({ across: HALF * 0.7 }).lateral;
    const edge = hand({ across: EDGE }).lateral;
    expect(mid).toBeLessThan(0);
    expect(edge).toBeLessThan(mid);
    expect(edge).toBeCloseTo(-TUNING.assist.ramp.centre, 6);
    expect(hand({ across: -EDGE }).lateral).toBeCloseTo(TUNING.assist.ramp.centre, 6);
    // And never more than `most`, however sideways the hull arrived.
    expect(hand({ across: EDGE, vAcross: 40 }).lateral).toBeCloseTo(-TUNING.assist.ramp.most, 6);
  });

  it("brings the bow round to the deck's axis, past a band it does not", () => {
    // Clockwise from above is +y, and `aim` is the band inside which a
    // rider is simply pointing where he meant to.
    expect(hand({ yaw: TUNING.assist.ramp.aim * 0.9 }).ty).toBeCloseTo(0, 12);
    expect(hand({ yaw: 0.3 }).ty).toBeLessThan(0);
    expect(hand({ yaw: -0.3 }).ty).toBeGreaterThan(0);
  });

  it("is not a gutter: it does not move a hull that is not going up the deck", () => {
    // The whole of it fades with the pace ALONG the deck. A hull parked
    // on a ramp, one sliding back down it and one crossing it broadside
    // are all left exactly where they are, however far off the middle
    // they sit — which is the difference between a help and a magnet.
    for (const vAlong of [0, -6, -0.01]) {
      feelsNothing(hand({ across: EDGE, vAlong, yaw: 0.4 }), `${vAlong} m/s up the deck`);
    }
    // ...and it fades IN with that pace rather than arriving all at once.
    const slow = hand({ across: EDGE, vAlong: TUNING.assist.ramp.pace / 3 }).lateral;
    const quick = hand({ across: EDGE, vAlong: TUNING.assist.ramp.pace }).lateral;
    expect(slow).toBeGreaterThan(quick);
    expect(slow).toBeLessThan(0);
  });

  it("stands aside for a rider steering, and at a dial of 0 is not there", () => {
    feelsNothing(hand({ across: EDGE, vAcross: 2, yaw: 0.3, steer: 1 }), "a rider steering");
    feelsNothing(hand({ across: EDGE, vAcross: 2, yaw: 0.3, strength: 0 }), "a dial at 0");
    // Half a dial is half a hand — a difficulty setting is a scale, not
    // a switch.
    const full = hand({ across: EDGE, vAcross: 2 }).lateral;
    expect(hand({ across: EDGE, vAcross: 2, strength: 0.5 }).lateral).toBeCloseTo(full / 2, 9);
  });

  /** Ride at the ramp from eight metres before the hinge, `across` metres
   * off its centreline and `yaw` rad off its axis, with the throttle open
   * and the rider's hands still; report how far up the deck the hull got
   * before it left it, by the lip or over a flank. */
  function runUp(rampAssistDial: number, across: number, yaw: number): number {
    const state = createGame({
      seed: 1,
      craft: "skiff",
      level: FLAT,
      assist: 0,
      rampAssist: rampAssistDial,
      quiet: true,
    });
    placeRun(state, {
      x: deckX(-8, across),
      z: deckZ(-8, across),
      heading: RAMP.heading + yaw,
      speed: 14,
    });
    let best = -Infinity;
    let aboard = false;
    for (let i = 0; i < 3 * TUNING.physicsHz; i++) {
      step(state, { steer: 0, throttle: 1, reverse: 0, lean: 0, crouch: 0, reset: false });
      const c = state.craft;
      aboard ||= c.onRamp;
      const at = onRampDeck(RAMP, c.x, c.z);
      // Off the deck once it has been on it: either over the lip or out
      // through a flank, and `best` is which.
      if (!at) {
        if (aboard) break;
        continue;
      }
      best = Math.max(best, at.along);
    }
    return best;
  }

  it("follows a jump through that the bare physics skids off the side of", () => {
    // Two fifths of the way out to the flank and eleven degrees off the
    // axis: bare, the hull is over the flank less than half way up; with
    // the hand, it leaves off the end.
    //
    // A FRACTION of the half-width rather than a distance, because R33
    // made the deck a dial and every number in `TUNING.assist.ramp` is a
    // fraction for the same reason — and the ANGLE moved with the width.
    // On the four-metre deck this bench was first written against, a metre
    // off the centreline and six degrees off the axis was already a jump
    // the bare physics lost. On R8's eight-metre deck that same line goes
    // over the lip with nothing helping it: mapped across the deck, the
    // bare hull now follows through everywhere inside two fifths out and
    // eight degrees off, and the line that still loses the jump is one a
    // rider would SEE he had not made. That is the widening doing exactly
    // what it is for, and the case the hand exists for is what is left.
    const off = HALF * 0.4;
    expect(runUp(0, off, 0.2)).toBeLessThan(RAMP.length - 1.5);
    expect(runUp(1, off, 0.2)).toBeGreaterThan(RAMP.length - 0.2);
  });

  it("leaves a jump already lined up exactly where it was", () => {
    // Lined up — bow on the deck's axis, anywhere in the part of it a
    // rider rides — the two dials come back bit-identical over a whole
    // run up it, which is the property every one of the unit cases above
    // is really about. Out past `free` of the half-width the camber does
    // act on a straight-running hull, and it is meant to: that is the
    // last half-metre before the flank, not the line anybody aims at.
    for (const across of [0, 0.5, HALF * TUNING.assist.ramp.free * 0.9]) {
      expect(runUp(1, across, 0), `${across} m off the middle`).toBeCloseTo(runUp(0, across, 0), 9);
    }
  });
});
