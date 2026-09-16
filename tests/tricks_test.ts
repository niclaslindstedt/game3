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
  ridingCrest,
  step,
  topSpeedOf,
  waveUnder,
  wavePointsPerSecond,
  type CraftInput,
  type GameEvent,
  type GameState,
  type WaveUnder,
} from "@engine";

import { syntheticLevel } from "./support/synthetic.ts";

const FLAT = syntheticLevel({ windSpeed: 0, noSolids: true, depth: 30 });
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
    // THE AIR COMES FIRST. The flight is past `airElement` long before the
    // revolution closes, and the rung it is owed is credited by the trick
    // that sells it (rule 3) — so the first two elements of any flipped
    // combo are the air and then the flip, in that order, which is the
    // order the line reads in.
    const won = events.filter((e) => e.kind === "trick");
    expect(won[0]?.kind === "trick" && won[0].trick).toBe("air");
    expect(won[0]?.kind === "trick" && won[0].points).toBe(0);
    const trick = won[1];
    expect(trick).toBeDefined();
    if (trick?.kind !== "trick") return;
    expect(trick.trick).toBe("backflip");
    expect(trick.spins).toBe(1);
    expect(trick.points).toBe(TUNING.tricks.flipPoints);
    // A single flip flown in real air is ×3: the multiplier starts at 1,
    // the air it was turned in is worth one step and the revolution
    // another.
    expect(trick.mult).toBe(3);
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
    // inside the flight: nose-up is a negative body x rate. Ten and not
    // more, so the first of them closes PAST `airElement` — a revolution
    // turned inside the first half-second is scored before the air it is
    // in has become an element, and this case is about the flips.
    const events = ride(state, 2.2, (s) => {
      if (s.craft.airborne) s.craft.wx = -10;
      return COAST;
    });
    // The air's own rung is in front of them (rule 3), so the two
    // revolutions are the second and third elements.
    const tricks = events.filter((e) => e.kind === "trick").slice(1);
    expect(tricks.length).toBeGreaterThanOrEqual(2);
    if (tricks[0]?.kind !== "trick" || tricks[1]?.kind !== "trick") return;
    expect(tricks[0].spins).toBe(1);
    expect(tricks[0].points).toBe(T.flipPoints);
    expect(tricks[0].mult).toBe(3);
    expect(tricks[1].spins).toBe(2);
    expect(tricks[1].points).toBe(2 * T.flipPoints);
    // ...and the ladder is unchanged underneath it: the second revolution
    // is worth two steps where the first was worth one, so the flips alone
    // are ×4 and the air rides on top.
    expect(tricks[1].mult).toBe(5);
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
    // REVOLUTIONS, which is what a hull thrown about by a sea could
    // accumulate by accident and must not. The crest ride is the other half
    // of the claim and it is not one: this run is a hull driven straight
    // down a shore with the sea coming in on its beam, which is a hull
    // running ALONG the waves, and holding the top of one is the trick.
    const turned = events.filter(
      (e) => e.kind === "trick" && (e.trick === "roll" || e.trick.endsWith("flip")),
    );
    expect(turned).toHaveLength(0);
  });
});

describe("the side spin", () => {
  /** One jump off calm water with the bars thrown over and held there —
   * the whole of THE WHIP (`strokes.ts`) as a rider on a touchscreen
   * delivers it, and what it pays. */
  function rolled(craft: "skiff" | "dart", side: number, seconds = 3.5) {
    const state = createGame({ seed: 1, craft, level: FLAT, quiet: true });
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 18, height: 1.5, vy: 9 });
    let turned = 0;
    const events = ride(state, seconds, (s) => {
      turned = Math.max(turned, Math.abs(s.tricks.roll));
      return { ...COAST, steer: side };
    });
    return { events, turned, state };
  }

  it("comes round on the bars alone, and is named a roll whichever way it went", () => {
    for (const side of [1, -1]) {
      const { events, turned } = rolled("dart", side);
      expect(turned).toBeGreaterThan(2 * Math.PI);
      const roll = events.find((e) => e.kind === "trick" && e.trick === "roll");
      expect(roll).toBeDefined();
      if (roll?.kind !== "trick") return;
      expect(roll.spins).toBe(1);
      expect(roll.points).toBe(TUNING.tricks.rollPoints);
    }
  });

  it("goes the way the bars went: right is right side down", () => {
    // `flight.ts`'s convention, read off the state rather than the event —
    // the name does not carry the side, so this is the only place it can
    // be checked. Positive steer is the bars over to the right and a
    // right-side-down roll is the positive sense of `tricks.roll`.
    expect(rolled("dart", 1, 1.2).state.tricks.roll).toBeGreaterThan(0);
    expect(rolled("dart", -1, 1.2).state.tricks.roll).toBeLessThan(0);
  });

  it("is not turned by a hull steering through a jump under the line", () => {
    // THE GATE, which is what keeps the levelling loop — and the ordinary
    // business of steering — out of the trick, and what `sim/bot.ts` caps
    // itself at. A whole flight spent holding just under it, which is most
    // of full lock, buys no throw at all.
    const state = createGame({ seed: 1, craft: "dart", level: FLAT, quiet: true });
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 18, height: 1.5, vy: 9 });
    const events = ride(state, 3.5, () => ({
      ...COAST,
      steer: TUNING.flight.whipGate * 0.99,
    }));
    expect(events.filter((e) => e.kind === "trick" && e.trick === "roll")).toHaveLength(0);
  });

  it("climbs its own ladder: a double roll is ×4 of the rolls, not ×3", () => {
    const T = TUNING.tricks;
    const state = game();
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 15, height: 1.5, vy: 9 });
    // Rolled by hand at a rate that turns two inside the flight, the way
    // the flip's own ladder case is: right side down is a negative body z
    // rate.
    const events = ride(state, 2.2, (s) => {
      if (s.craft.airborne) s.craft.wz = -10;
      return COAST;
    });
    const rolls = events.filter((e) => e.kind === "trick" && e.trick === "roll");
    expect(rolls.length).toBeGreaterThanOrEqual(2);
    if (rolls[0]?.kind !== "trick" || rolls[1]?.kind !== "trick") return;
    expect(rolls[0].points).toBe(T.rollPoints);
    expect(rolls[1].spins).toBe(2);
    expect(rolls[1].points).toBe(2 * T.rollPoints);
    expect(rolls[1].mult - rolls[0].mult).toBe(2);
  });

  it("is counted apart from the flip: one of each is two first revolutions", () => {
    // The two axes keep their own indices, so a flip with a roll in it is
    // ×3 of the tricks (1 + 1) and not ×2 of one doubled — which is what
    // stops a corkscrew being priced as a double of either.
    const state = game();
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 15, height: 1.5, vy: 10 });
    const events = ride(state, 2.6, (s) => {
      if (s.craft.airborne) {
        s.craft.wx = -4;
        s.craft.wz = -4;
      }
      return COAST;
    });
    const won = events.filter((e) => e.kind === "trick");
    const kinds = won.map((e) => (e.kind === "trick" ? e.trick : ""));
    expect(kinds).toContain("backflip");
    expect(kinds).toContain("roll");
    for (const e of won) {
      if (e.kind === "trick" && e.trick !== "air") expect(e.spins).toBe(1);
    }
  });
});

describe("the air as an element", () => {
  it("buys a rung of its own the moment a trick lands beside it", () => {
    const state = game();
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 15, height: 1.5, vy: 9 });
    const events = ride(state, 2.4, (s) => {
      if (s.craft.airborne) s.craft.wx = -4;
      return COAST;
    });
    const won = events.filter((e) => e.kind === "trick");
    expect(won[0]?.kind === "trick" && won[0].trick).toBe("air");
    // One step, and no base: the seconds were already paid for by the
    // second and are not sold twice.
    expect(won[0]?.kind === "trick" && won[0].points).toBe(0);
    expect(won[0]?.kind === "trick" && won[0].mult).toBe(2);
  });

  it("is worth nothing on its own: a plain jump banks at ×1", () => {
    const state = game();
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 15, height: 1.5, vy: 9 });
    const events = ride(state, 5);
    expect(events.filter((e) => e.kind === "trick")).toHaveLength(0);
    const combo = events.find((e) => e.kind === "combo");
    expect(combo?.kind === "combo" && combo.mult).toBe(1);
  });

  it("is sold once per combo, not once per flight", () => {
    // Two linked flights with a revolution in each. The second flight is
    // air past the line as well, and it must not buy a second rung — a
    // rider who could would climb the ladder by hopping.
    const state = game();
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 15, height: 1.5, vy: 9 });
    const events: GameEvent[] = [];
    events.push(
      ...ride(state, 2.4, (s) => {
        if (s.craft.airborne) s.craft.wx = -4;
        return COAST;
      }),
    );
    // Straight back up inside the link window, and round again.
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 15, height: 1.5, vy: 9 });
    events.push(
      ...ride(state, 2.4, (s) => {
        if (s.craft.airborne) s.craft.wx = -4;
        return COAST;
      }),
    );
    const airs = events.filter((e) => e.kind === "trick" && e.trick === "air");
    expect(airs).toHaveLength(1);
  });

  it("is in the combo's element list, in front of the trick that sold it", () => {
    const state = game();
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 15, height: 1.5, vy: 9 });
    ride(state, 2.4, (s) => {
      if (s.craft.airborne) s.craft.wx = -4;
      return COAST;
    });
    expect(state.tricks.parts.map((p) => p.kind)).toEqual(["air", "backflip"]);
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
    // The bare physics, because the arcade's hand on a landing is what
    // keeps the second flight below from becoming the dive it has to be.
    const state = createGame({ seed: 1, craft: "skiff", level: FLAT, assist: 0, quiet: true });
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 15, height: 1.5, vy: 8 });
    ride(state, 6);
    const banked = state.tricks.score;
    expect(banked).toBeGreaterThan(0);
    // A second flight, thrown away by going over the bars at the end of it:
    // it comes down nose-first at pace with nobody on the bars, buries the
    // bow, goes under and corks out on its back, and the water brings it
    // up (`floatUp`) — which is the bail.
    //
    // A FLOAT-UP rather than a capsize, and it has to be: `capsize.after` =
    // 1.5 s is longer than the `tricks.linkWindow` = 1 s a combo stays open
    // for once the hull is down, so a hull rolled onto its back always
    // banks before it is declared over. The float-up is the half of "over
    // the bars" that can actually reach an open combo.
    placeRun(state, {
      x: 100,
      z: 200,
      heading: Math.PI / 2,
      speed: topSpeedOf(state.craft.spec) * 0.9,
      height: 3,
      pitch: -0.6,
    });
    ride(state, 0.5);
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

describe("the water", () => {
  const GAS: CraftInput = { ...COAST, throttle: 1 };

  /** Nose down into calm water from a height at nine tenths of the top
   * speed, and then whatever `input` says — the app's `dive` scenario, with
   * the rider's answer scripted. */
  function submarine(
    craft: "skiff" | "dart" | "marlin" | "otter",
    seconds: number,
    input: (state: GameState) => CraftInput,
    pitch = -0.6,
    height = 3,
  ): { state: GameState; events: GameEvent[]; baseUnder: number } {
    // The bare physics: the arcade's hand on a landing is exactly what
    // keeps a nose-down entry from becoming a dive, and the dive is the
    // subject.
    const state = createGame({ seed: 1, craft, level: FLAT, assist: 0, quiet: true });
    const top = topSpeedOf(state.craft.spec);
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: top * 0.9, height, pitch });
    let baseUnder = 0;
    const events = ride(state, seconds, (s) => {
      if (s.craft.under && s.craft.underTime > TUNING.submerged.counts) {
        baseUnder = Math.max(baseUnder, s.tricks.base);
      }
      return input(s);
    });
    return { state, events, baseUnder };
  }

  it("ticks like the air while the hull is under, and holds the combo open", () => {
    // The stand-up on the gas with no lean drives itself along under the
    // surface for seconds and rides back out clean.
    const { state, events, baseUnder } = submarine("dart", 7, () => GAS);
    const out = events.find((e) => e.kind === "surface");
    expect(out?.kind === "surface" && out.clean).toBe(true);
    expect(out?.kind === "surface" && out.underTime).toBeGreaterThan(TUNING.tricks.diveElement);
    expect(baseUnder).toBeGreaterThan(0);
    // The spell's seconds are what the purse is made of: the base at the
    // surfacing is at least the rate integrated over the spell past the line.
    expect(events.some((e) => e.kind === "bail")).toBe(false);
    expect(state.tricks.score).toBeGreaterThan(0);
  });

  it("pays the SUBMARINE on a clean surfacing — a rung and no base, like the air's own", () => {
    const { events } = submarine("dart", 7, () => GAS);
    const won = events.filter((e) => e.kind === "trick");
    const sub = won.find((e) => e.kind === "trick" && e.trick === "submarine");
    expect(sub).toBeDefined();
    if (sub?.kind !== "trick") return;
    expect(sub.points).toBe(0);
    expect(sub.spins).toBe(1);
    // THE AIR SELLS THROUGH THE DIVE: the flight it fell out of lasted past
    // `airElement`, and a jump dived into and ridden out of is the air and
    // the submarine in one combo, in that order.
    expect(won[0]?.kind === "trick" && won[0].trick).toBe("air");
    expect(sub.mult).toBe(3);
    const combo = events.find((e) => e.kind === "combo");
    expect(combo?.kind === "combo" && combo.mult).toBe(3);
  });

  it("bails when the water has to bring the hull up, and not on the bow going in", () => {
    // Nobody on the bars: the hull corks out on its back and is floated
    // up, and everything riding on the combo goes with it.
    const coast = submarine("skiff", 6, () => COAST);
    expect(coast.events.some((e) => e.kind === "dive")).toBe(true);
    const up = coast.events.findIndex((e) => e.kind === "floatUp");
    const bail = coast.events.findIndex((e) => e.kind === "bail");
    expect(up).toBeGreaterThanOrEqual(0);
    expect(bail).toBeGreaterThan(up);
    expect(coast.events.some((e) => e.kind === "combo")).toBe(false);
    // The same bow buried, ridden out with the lean back: no bail, and the
    // flight that went in banks as a combo. Seven seconds, not six: the
    // marlin is out at about five, and the combo closes a link window
    // after that.
    const ridden = submarine(
      "marlin",
      7,
      (s) => ({ ...GAS, lean: s.craft.under || s.craft.pitch < -0.3 ? 1 : 0 }),
      -0.9,
      4,
    );
    expect(ridden.events.some((e) => e.kind === "dive")).toBe(true);
    expect(ridden.events.some((e) => e.kind === "bail")).toBe(false);
    expect(ridden.events.some((e) => e.kind === "combo")).toBe(true);
  });
});

// ── THE WATER'S OWN TRICKS ──────────────────────────────────────────────
// A sea to ride rather than a flat calm: the synthetic coast in a fresh
// breeze over twenty metres of water, which is where a wave with a metre in
// it stands. The shore runs along x at z = 0, so a hull steered EAST is
// running along the crests of a sea coming in off the water and a hull
// steered SEAWARD is driving across them — which is the whole difference
// the crest ride measures.
const SEAWAY = syntheticLevel({
  windSpeed: 14,
  noSolids: true,
  depth: 20,
  seaward: 1400,
  plan: 3000,
});
const EAST = Math.PI / 2;
const OFFSHORE = 0;
/** The throttle held and nothing else asked for. */
const DRIVE: CraftInput = {
  steer: 0,
  throttle: 0.85,
  reverse: 0,
  lean: 0,
  crouch: 0,
  reset: false,
};

function seaway(): GameState {
  return createGame({ seed: 3, craft: "skiff", level: SEAWAY, quiet: true });
}

/** Hold the throttle on one heading through that sea, and report what the
 * water paid for: the crest rides won, and the longest one held. */
function drive(heading: number, seconds: number, z = 260) {
  const state = seaway();
  placeRun(state, { x: 0, z, heading, speed: 18 });
  let held = 0;
  const events = ride(state, seconds, (s) => {
    held = Math.max(held, s.tricks.rideTime);
    return DRIVE;
  });
  const won = events.filter((e) => e.kind === "trick" && e.trick === "wave");
  return { won, held, state };
}

describe("the wave under the hull", () => {
  const out: WaveUnder = { height: 0, share: 0 };

  it("reads the wave passing a point, and where in it the water stands", () => {
    // A swell quoted outright, so the sea is one band and the sweep has a
    // clean wave to find. Followed through a whole period, the share must
    // reach both ends of the wave and the height must be the swell's.
    const state = createGame({ seed: 1, craft: "skiff", level: FLAT, quiet: true, sea: { hs: 2 } });
    let lowest = 1;
    let highest = 0;
    let height = 0;
    for (let i = 0; i < 2 * TUNING.physicsHz; i++) {
      step(state, COAST);
      waveUnder(state.sea, state.level, 200, 300, state.t, out);
      lowest = Math.min(lowest, out.share);
      highest = Math.max(highest, out.share);
      height = Math.max(height, out.height);
    }
    expect(lowest).toBeLessThan(0.1);
    expect(highest).toBeGreaterThan(0.9);
    // Crest to trough of an individual wave, which is the order of the
    // significant height the swell was quoted at rather than a multiple of it.
    expect(height).toBeGreaterThan(1);
    expect(height).toBeLessThan(4);
  });

  it("is 0 on a flat calm, and nothing there is a ride", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: FLAT, quiet: true, sea: { hs: 0 } });
    ride(state, 0.5);
    waveUnder(state.sea, state.level, 200, 300, state.t, out);
    expect(out.height).toBeLessThan(0.01);
    expect(ridingCrest(state.craft, out, false)).toBe(false);
  });
});

describe("the crest ride", () => {
  it("pays the air's curve at its own rate", () => {
    const T = TUNING.tricks;
    expect(wavePointsPerSecond(T.waveKnee)).toBeCloseTo(T.waveRate, 6);
    expect(wavePointsPerSecond(0)).toBe(0);
    expect(wavePointsPerSecond(4)).toBeGreaterThan(wavePointsPerSecond(2));
    // Quieter than the air, second for second, the whole way up.
    for (const t of [0.5, 1, 3, 10]) {
      expect(wavePointsPerSecond(t)).toBeLessThan(airPointsPerSecond(t));
    }
  });

  it("is won by running ALONG the sea and not by driving across it", () => {
    const along = drive(EAST, 40);
    const across = drive(OFFSHORE, 40, 150);
    expect(along.won.length).toBeGreaterThan(0);
    expect(along.state.tricks.score).toBeGreaterThan(0);
    // Same sea, same throttle, same seconds: the heading is the whole
    // difference, and it is the difference between holding the top of a
    // wave and being thrown over one after another. There is no term in the
    // rule for "along" — it falls out of the hold (`wave-ride.ts`).
    expect(across.won).toHaveLength(0);
    expect(across.held).toBeLessThan(TUNING.tricks.waveElement);
  });

  it("wants a wave with something in it: a flat calm pays nothing", () => {
    // Twelve seconds under way, so the hull has laid a WASH of its own by
    // now (`wash.ts` sums it into `surfaceAt`, which is what `waveUnder`
    // reads). A rider may ride somebody's wake where it is big enough, but
    // his own on a flat calm never reaches `waveHeight` — this is the case
    // that says so.
    const calm = createGame({ seed: 3, craft: "skiff", level: FLAT, quiet: true });
    placeRun(calm, { x: 100, z: 200, heading: EAST, speed: 18 });
    const events = ride(calm, 12, () => DRIVE);
    expect(events.filter((e) => e.kind === "trick")).toHaveLength(0);
    expect(calm.tricks.score).toBe(0);
  });

  it("wants a rider, not a float: a hull lying in the same sea pays nothing", () => {
    // The same water that pays a rider running along it. A hull with no way
    // on sits at the top of a wave for a second and a half at a time, which
    // is past the element's own line — being under way is the whole of what
    // stops that being a trick.
    const state = seaway();
    placeRun(state, { x: 0, z: 260, heading: EAST, speed: 0 });
    const events = ride(state, 30, () => COAST);
    expect(Math.abs(state.craft.way)).toBeLessThan(TUNING.tricks.riding);
    expect(events.filter((e) => e.kind === "trick" && e.trick === "wave")).toHaveLength(0);
  });

  it("is one element however long it is held, and the next crest is a new one", () => {
    const state = seaway();
    placeRun(state, { x: 0, z: 260, heading: EAST, speed: 18 });
    let held = 0;
    let starts = 0;
    let riding = false;
    const events = ride(state, 40, (s) => {
      held = Math.max(held, s.tricks.rideTime);
      if (s.tricks.riding && !riding) starts += 1;
      riding = s.tricks.riding;
      return DRIVE;
    });
    const won = events.filter((e) => e.kind === "trick" && e.trick === "wave");
    expect(held).toBeGreaterThan(TUNING.tricks.waveElement);
    // Never more elements than rides begun: a hold that lasts ten seconds
    // is one element and ten seconds of ticking, and a rider chains them by
    // coming off one crest and catching the next.
    expect(won.length).toBeGreaterThan(0);
    expect(won.length).toBeLessThanOrEqual(starts);
    // The rung it buys, and no base of its own: the seconds are paid by the
    // second and are not sold twice.
    for (const e of won) if (e.kind === "trick") expect(e.points).toBe(0);
  });
});

describe("the corkscrew", () => {
  /** One flight with both axes turned in it, as `flight_test` turns them:
   * the body rates set directly, so what is measured is the SCORE's reading
   * of a flight and not whether a rider could throw one. */
  function corked(wx: number, wz: number, seconds = 2.6): GameEvent[] {
    const state = game();
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 20, height: 1.5, vy: 10 });
    return ride(state, seconds, (s) => {
      if (s.craft.airborne) {
        s.craft.wx = wx;
        s.craft.wz = wz;
      }
      return COAST;
    });
  }

  it("is won by the second axis coming round, once, and worth its own rung", () => {
    const won = corked(-4, -4).filter((e) => e.kind === "trick");
    const kinds = won.map((e) => (e.kind === "trick" ? e.trick : ""));
    expect(kinds).toContain("backflip");
    expect(kinds).toContain("roll");
    expect(kinds.filter((k) => k === "corkscrew")).toHaveLength(1);
    const cork = won.find((e) => e.kind === "trick" && e.trick === "corkscrew");
    if (cork?.kind !== "trick") throw new Error("no corkscrew");
    // It comes AFTER both revolutions: it is the thing doing them together
    // was, and there is nothing to credit until both are round.
    expect(kinds.indexOf("corkscrew")).toBeGreaterThan(kinds.indexOf("backflip"));
    expect(kinds.indexOf("corkscrew")).toBeGreaterThan(kinds.indexOf("roll"));
    expect(cork.points).toBe(TUNING.tricks.corkscrewPoints);
    expect(cork.spins).toBe(1);
    // The air, both first revolutions and the combination: ×5.
    expect(cork.mult).toBe(5);
  });

  it("is not won by one axis alone, however many turns of it there are", () => {
    for (const [wx, wz] of [
      [-8, 0],
      [0, -10],
    ]) {
      const won = corked(wx, wz).filter((e) => e.kind === "trick");
      const kinds = won.map((e) => (e.kind === "trick" ? e.trick : ""));
      expect(kinds.length).toBeGreaterThan(1);
      expect(kinds).not.toContain("corkscrew");
    }
  });

  it("prices the two axes together above the same two taken off two waves", () => {
    // What the combo is WORTH the moment the second revolution is round —
    // `base × mult`, which is what the window would bank. Read there rather
    // than at the bank because whether a flight lands is the LANDING's rule
    // and has its own cases: a hull that rolls without flipping comes down
    // on its bow whatever the score thinks of it.
    const worth = (state: GameState) => state.tricks.base * state.tricks.mult;
    const together = (() => {
      const state = game();
      placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 20, height: 1.5, vy: 10 });
      let last = 0;
      ride(state, 2.6, (s) => {
        if (s.events.some((e) => e.kind === "trick")) last = worth(s);
        if (s.craft.airborne) {
          s.craft.wx = -4;
          s.craft.wz = -4;
        }
        return COAST;
      });
      return last;
    })();
    const apart = (() => {
      const state = game();
      // A flip off one wave, a roll off the next, inside the link window —
      // one combo of the same two revolutions, one flight apart.
      placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 20, height: 1.5, vy: 10 });
      let last = 0;
      const turn = (axis: "wx" | "wz") => (s: GameState) => {
        if (s.events.some((e) => e.kind === "trick")) last = worth(s);
        if (s.craft.airborne) s.craft[axis] = -4;
        return COAST;
      };
      ride(state, 2.6, turn("wx"));
      placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 20, height: 1.5, vy: 10 });
      ride(state, 2.4, turn("wz"));
      return last;
    })();
    expect(apart).toBeGreaterThan(0);
    expect(together).toBeGreaterThan(apart);
  });

  it("is worth nothing unless the rider lands it: a corked dive banks none of it", () => {
    const state = game();
    // Launched with the nose already dropping, so the flight ends bow-first
    // and buries it — which is a `dive`, and a dive is a bail.
    placeRun(state, {
      x: 100,
      z: 200,
      heading: Math.PI / 2,
      speed: 20,
      height: 1.5,
      vy: 10,
      pitchRate: -1.2,
    });
    const events = ride(state, 14, (s) => {
      if (s.craft.airborne) {
        s.craft.wx = -5;
        s.craft.wz = -5;
      }
      return COAST;
    });
    expect(events.some((e) => e.kind === "trick" && e.trick === "corkscrew")).toBe(true);
    expect(events.some((e) => e.kind === "bail")).toBe(true);
    expect(events.filter((e) => e.kind === "combo")).toHaveLength(0);
    expect(state.tricks.score).toBe(0);
  });
});

describe("the laydown", () => {
  /** The hull stood at a heel on calm water under way, and left to come
   * back up: the one element that needs neither air nor a wave. */
  function heelTo(roll: number, speed = 18): { events: GameEvent[]; state: GameState } {
    const state = game();
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed, roll });
    const events = ride(state, 6, () => ({
      steer: 0,
      throttle: speed > 0 ? 0.6 : 0,
      reverse: 0,
      lean: 0,
      crouch: 0,
      reset: false,
    }));
    return { events, state };
  }

  const laydowns = (events: GameEvent[]): GameEvent[] =>
    events.filter((e) => e.kind === "trick" && e.trick === "laydown");

  it("is won by going past the angle and coming back level", () => {
    const { events, state } = heelTo(TUNING.tricks.laydownAngle + 0.15);
    const won = laydowns(events);
    expect(won).toHaveLength(1);
    if (won[0]?.kind !== "trick") return;
    expect(won[0].points).toBe(TUNING.tricks.laydownPoints);
    expect(won[0].mult).toBe(2);
    expect(state.tricks.score).toBeGreaterThan(0);
  });

  it("is not won by a lean that never got there", () => {
    expect(laydowns(heelTo(TUNING.tricks.laydownAngle - 0.15).events)).toHaveLength(0);
  });

  it("is not won by a hull on its beam ends righting itself", () => {
    // Past `laydownOver` the rider is going over rather than laying it
    // down, and the whole way back up passes through the laydown's own
    // band. What comes back from there is a capsize saved.
    expect(laydowns(heelTo(TUNING.tricks.laydownOver + 0.2).events)).toHaveLength(0);
  });

  it("is not won by a hull with no way on it", () => {
    const { events, state } = heelTo(TUNING.tricks.laydownAngle + 0.15, 0);
    expect(Math.abs(state.craft.way)).toBeLessThan(TUNING.tricks.riding);
    expect(laydowns(events)).toHaveLength(0);
  });
});

describe("staying in play", () => {
  it("holds the combo open while the top of a wave is held", () => {
    // A crest ride longer than the link window: nothing banks while it
    // lasts, because the rider is still doing something.
    const state = seaway();
    placeRun(state, { x: 0, z: 260, heading: EAST, speed: 18 });
    let openest = 0;
    const events = ride(state, 40, (s) => {
      if (s.tricks.rideTime > TUNING.tricks.linkWindow) openest = Math.max(openest, s.tricks.link);
      return DRIVE;
    });
    expect(openest).toBeGreaterThan(0);
    // The ride buys a rung, so what does bank is banked at a multiplier.
    const banked = events.filter((e) => e.kind === "combo");
    expect(banked.length).toBeGreaterThan(0);
    expect(banked.some((e) => e.kind === "combo" && e.mult > 1)).toBe(true);
  });

  it("links a trick off one wave to a trick off the next", () => {
    // Two laydowns inside one window are ONE combo at ×3 off twice the
    // base, which is the whole of what the window is for: the rider who
    // comes off one wave straight into the next is doing one thing.
    const state = game();
    const LEAN: CraftInput = {
      steer: 0,
      throttle: 0.6,
      reverse: 0,
      lean: 0,
      crouch: 0,
      reset: false,
    };
    const heel = () =>
      placeRun(state, {
        x: state.craft.x,
        z: 200,
        heading: Math.PI / 2,
        speed: 18,
        roll: TUNING.tricks.laydownAngle + 0.15,
      });
    /** Step until the hull has come back level and the element is won. */
    const untilWon = (): number => {
      for (let i = 0; i < 4 * TUNING.physicsHz; i++) {
        step(state, LEAN);
        for (const e of state.events) if (e.kind === "trick") return state.tricks.mult;
      }
      return 0;
    };
    heel();
    expect(untilWon()).toBe(2);
    // Straight into the second, with the window still open.
    expect(state.tricks.link).toBeGreaterThan(0);
    heel();
    expect(untilWon()).toBe(3);
    const rest = ride(state, 3, () => LEAN);
    const combo = rest.find((e) => e.kind === "combo");
    expect(combo).toBeDefined();
    if (combo?.kind !== "combo") return;
    expect(combo.mult).toBe(3);
    expect(combo.base).toBe(2 * TUNING.tricks.laydownPoints);
  });
});
