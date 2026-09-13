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
    expect(events.filter((e) => e.kind === "trick")).toHaveLength(0);
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
