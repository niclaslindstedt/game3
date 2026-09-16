// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FOUR MODES (`engine/game/defs/modes.ts`, `run.ts`, `rivals.ts`): what
// a mode switches on, and that the engine underneath is the same engine —
// the open rules a measurement rides are unchanged, the lights hold the
// clock and the throttle, a timed run ends on the buzzer with its combo
// paid, a run with no course sends a reset to a ramp, and a race stands a
// field on the grid, rides it with the bot and lets it be leaned on.
import { describe, expect, it } from "vitest";

import {
  MODE_RULES,
  OPEN_RULES,
  RACE,
  TRICK_LIMITS,
  TRICK_RESET_BACK,
  TUNING,
  botInput,
  craftById,
  createGame,
  fieldOrder,
  gridPoses,
  placeRun,
  playerSlot,
  racePlace,
  rivalSlot,
  rulesFor,
  sampleField,
  standCraft,
  step,
  surfaceAt,
  type CraftInput,
  type GameEvent,
  type GameState,
} from "@engine";

import { syntheticLevel } from "./support/synthetic.ts";

const FLAT = syntheticLevel({ windSpeed: 0, noSolids: true });
const COAST: CraftInput = { steer: 0, throttle: 0, reverse: 0, lean: 0, crouch: 0, reset: false };
const FLAT_OUT: CraftInput = { ...COAST, throttle: 1 };

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

describe("the rules a run is dealt", () => {
  it("are the OPEN rules when nothing asks for a mode — every system on, nothing else", () => {
    expect(rulesFor({})).toEqual(OPEN_RULES);
    expect(OPEN_RULES).toEqual({
      course: true,
      tricks: true,
      rivals: 0,
      contact: true,
      countdown: 0,
      limit: 0,
    });
    const state = createGame({ seed: 1, level: FLAT, quiet: true });
    expect(state.rules).toEqual(OPEN_RULES);
    expect(state.phase).toBe("running");
    expect(state.rivals).toEqual([]);
  });

  it("switch the tricks off in a race and a time trial, and the course off in a tricks run", () => {
    expect(MODE_RULES.race.tricks).toBe(false);
    expect(MODE_RULES.race.course).toBe(true);
    expect(MODE_RULES.race.rivals).toBe(RACE.rivals);
    expect(MODE_RULES.timeTrial).toEqual({ ...MODE_RULES.race, rivals: 0 });
    expect(MODE_RULES.tricks.course).toBe(false);
    expect(MODE_RULES.tricks.tricks).toBe(true);
    expect(MODE_RULES.tricks.rivals).toBe(0);
    expect(MODE_RULES.tricks.countdown).toBe(RACE.countdown);
    expect(MODE_RULES.tricks.limit).toBe(TRICK_LIMITS[0]);
  });

  it("deal a FREE ride the open rules — the same water, with a door on it", () => {
    // Free is not a fourth bundle of rules: it IS `OPEN_RULES`, which is what
    // keeps the mode a rider chooses and the rules a measurement rides from
    // ever drifting apart. The course still counts (there are gates to take
    // and a finish to cross), the tricks still score, and nothing holds the
    // rider at the start or ends the run on a buzzer.
    expect(MODE_RULES.free).toBe(OPEN_RULES);
    expect(rulesFor({ mode: "free" })).toEqual(OPEN_RULES);
    const state = createGame({ seed: 1, level: FLAT, mode: "free", quiet: true });
    expect(state.phase).toBe("running");
    expect(state.rivals).toEqual([]);
    expect(state.rules.course).toBe(true);
    expect(state.rules.tricks).toBe(true);
  });

  it("take a tricks run's length off the ladder, and nothing off it", () => {
    for (const limit of TRICK_LIMITS) expect(rulesFor({ mode: "tricks", limit }).limit).toBe(limit);
    expect(rulesFor({ mode: "tricks", limit: 7 }).limit).toBe(TRICK_LIMITS[0]);
    expect(rulesFor({ mode: "race", limit: TRICK_LIMITS[1] }).limit).toBe(0);
  });

  it("let a rule be set by hand over the mode's", () => {
    expect(rulesFor({ mode: "race", rules: { countdown: 0, rivals: 2 } })).toEqual({
      ...MODE_RULES.race,
      countdown: 0,
      rivals: 2,
    });
  });
});

describe("the lights", () => {
  it("hold the clock and the throttle, count down, and let go on GO", () => {
    const state = createGame({ seed: 1, level: FLAT, mode: "timeTrial", quiet: true });
    expect(state.phase).toBe("countdown");
    expect(state.countdown).toBe(RACE.countdown);
    const events = ride(state, RACE.countdown - 0.1, () => FLAT_OUT);
    expect(state.phase).toBe("countdown");
    expect(state.progress.time).toBe(0);
    expect(state.craft.speed).toBeLessThan(0.2);
    expect(
      events.filter((e) => e.kind === "count").map((e) => (e as { left: number }).left),
    ).toEqual([3, 2, 1]);
    expect(events.some((e) => e.kind === "go")).toBe(false);
    const rest = ride(state, 2, () => FLAT_OUT);
    const go = rest.find((e) => e.kind === "go");
    expect(go).toBeDefined();
    expect(state.phase).toBe("running");
    expect(state.countdown).toBe(0);
    expect(state.progress.time).toBeGreaterThan(1.5);
    expect(state.craft.speed).toBeGreaterThan(3);
    // ...and the sea did not wait: the world's clock ran through them.
    expect(state.t).toBeGreaterThan(RACE.countdown + 1.5);
  });

  it("are put out by a moment stood: a staged scene is never under them", () => {
    const state = createGame({ seed: 1, level: FLAT, mode: "timeTrial", quiet: true });
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 15 });
    expect(state.phase).toBe("running");
    expect(state.countdown).toBe(0);
    step(state, COAST);
    expect(state.craft.speed).toBeGreaterThan(10);
    expect(state.events.some((e) => e.kind === "count" || e.kind === "go")).toBe(false);
  });

  it("are not lit on the open rules, which are running from the first step", () => {
    const state = createGame({ seed: 1, level: FLAT, quiet: true });
    const events = ride(state, 0.5, () => FLAT_OUT);
    expect(events.some((e) => e.kind === "count" || e.kind === "go")).toBe(false);
    expect(state.progress.time).toBeCloseTo(0.5, 3);
  });
});

describe("a run with the tricks switched off", () => {
  /** Fly with the bars hauled back all the way: on the open rules that is a
   * stroke of the pump and the flight is a trick; with the tricks off it is
   * trim. */
  function haul(state: GameState): { tricking: boolean; tricks: number } {
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 15, height: 3, vy: 6 });
    let tricking = false;
    const events = ride(state, 2.5, () => {
      tricking = tricking || state.craft.tricking;
      return { ...COAST, lean: 1 };
    });
    return { tricking, tricks: events.filter((e) => e.kind === "trick").length };
  }

  it("reads a full lean in the air as trim: no stroke, no trick, no score", () => {
    const open = haul(createGame({ seed: 1, level: FLAT, quiet: true }));
    expect(open.tricking).toBe(true);
    const race = createGame({
      seed: 1,
      level: FLAT,
      mode: "timeTrial",
      rules: { countdown: 0 },
      quiet: true,
    });
    const trial = haul(race);
    expect(trial.tricking).toBe(false);
    expect(trial.tricks).toBe(0);
    expect(race.tricks.score).toBe(0);
    expect(race.tricks.base).toBe(0);
  });
});

describe("a tricks run", () => {
  it("counts no gate and finishes at nothing but the buzzer", () => {
    const state = createGame({
      seed: 1,
      level: FLAT,
      mode: "tricks",
      rules: { limit: 6 },
      quiet: true,
    });
    expect(state.phase).toBe("countdown");
    expect(state.countdown).toBe(RACE.countdown);
    // Straight down the row of buoys at speed: on the open rules that is
    // gate after gate; here it is water.
    placeRun(state, { x: 60, z: 40, heading: Math.PI / 2, speed: 20 });
    const events = ride(state, 5, () => FLAT_OUT);
    expect(events.some((e) => e.kind === "gate" || e.kind === "missedGate")).toBe(false);
    expect(state.progress.nextGate).toBe(0);
    expect(state.progress.time).toBeCloseTo(5, 3);
    expect(state.phase).toBe("running");
    const end = ride(state, 1.5, () => FLAT_OUT);
    const buzzer = end.find((e) => e.kind === "timeUp");
    expect(buzzer).toBeDefined();
    expect(state.phase).toBe("finished");
    expect(state.progress.finished).toBe(true);
    expect(state.progress.time).toBe(6);
    expect(end.some((e) => e.kind === "finish")).toBe(false);
  });

  it("pays the combo in hand on the buzzer", () => {
    const state = createGame({
      seed: 1,
      level: FLAT,
      mode: "tricks",
      rules: { limit: 5 },
      quiet: true,
    });
    // Thrown high at four seconds on the clock: still up, with air already
    // ticked into the combo, when the buzzer goes at five.
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 15, height: 4, vy: 8, time: 4 });
    const events = ride(state, 1.5);
    const buzzer = events.find((e) => e.kind === "timeUp");
    expect(buzzer?.kind === "timeUp" && buzzer.score).toBeGreaterThan(0);
    const combo = events.find((e) => e.kind === "combo");
    expect(combo).toBeDefined();
    expect(state.tricks.score).toBeGreaterThan(0);
    expect(state.tricks.base).toBe(0);
    // ...and nothing more is ever banked: the run is over.
    const after = ride(state, 3);
    expect(after.some((e) => e.kind === "combo" || e.kind === "timeUp")).toBe(false);
  });

  it("sends a reset to the foot of the nearest ramp's run-up, facing it", () => {
    const state = createGame({ seed: 1, level: FLAT, mode: "tricks", quiet: true });
    const ramp = FLAT.course.gates.find((g) => g.ramp)!.ramp!;
    placeRun(state, { x: 300, z: 120, heading: 0 });
    step(state, { ...COAST, reset: true });
    expect(state.events.some((e) => e.kind === "reset")).toBe(true);
    expect(state.craft.x).toBeCloseTo(ramp.x - TRICK_RESET_BACK, 3);
    expect(state.craft.z).toBeCloseTo(ramp.z, 3);
    expect(state.craft.heading).toBeCloseTo(ramp.heading, 6);
  });
});

describe("the grid", () => {
  it("stands every slot afloat, the front row on the start, the player at the back", () => {
    const slots = RACE.rivals + 1;
    const poses = gridPoses(FLAT, slots);
    expect(poses).toHaveLength(slots);
    const s = FLAT.start;
    // The front row's middle lane IS the start.
    expect(poses[1].x).toBeCloseTo(s.x, 6);
    expect(poses[1].z).toBeCloseTo(s.z, 6);
    for (const at of poses) {
      expect(at.heading).toBe(s.heading);
      // Every slot is on or behind the start line along its heading.
      const along = (at.x - s.x) * Math.sin(s.heading) + (at.z - s.z) * Math.cos(s.heading);
      expect(along).toBeLessThanOrEqual(1e-6);
    }
    // No two slots share water.
    for (let i = 0; i < slots; i++)
      for (let k = i + 1; k < slots; k++)
        expect(Math.hypot(poses[i].x - poses[k].x, poses[i].z - poses[k].z)).toBeGreaterThan(3);
    // The player's slot is the back row's middle, and the rivals fill the
    // rest in order around it.
    expect(playerSlot(slots)).toBe(10);
    expect(rivalSlot(0, slots)).toBe(0);
    expect(rivalSlot(9, slots)).toBe(9);
    expect(rivalSlot(10, slots)).toBe(11);
  });

  it("moves forward off a shore the back rows would stand on", () => {
    // A start with land three metres behind it: the rows behind would be
    // on the beach, so the whole grid goes forward until they are not.
    const shallow = {
      ...FLAT,
      start: { x: 20, z: 40, heading: 0 },
    };
    const poses = gridPoses(shallow, RACE.rivals + 1);
    for (const at of poses)
      expect(-sampleField(shallow.ground, at.x, at.z)).toBeGreaterThanOrEqual(RACE.gridDepth);
  });

  it("holds the field in the WATER under the lights, not against it", () => {
    // Making no way is having no velocity THROUGH the water. A coast has a
    // current in it (R27) and every wave has its orbit, so a hull pinned to
    // the GROUND in either has a flow past it — a moored buoy rather than a
    // rider sat on his machine — and a flow past a hull is a couple about
    // its ride plate. Every slot stands in the same current, so holding the
    // field against the ground swings the whole grid the same way at the same
    // rate.
    const state = createGame({ seed: 38, mode: "race", quiet: true });
    ride(state, RACE.countdown - 0.2, () => COAST);
    expect(state.phase).toBe("countdown");
    for (const c of [state.craft, ...state.rivals.map((r) => r.run.craft)]) {
      const water = surfaceAt(state.sea, state.level, c.x, c.z, state.t);
      expect(Math.hypot(c.vx - water.vx, c.vz - water.vz)).toBeLessThan(1e-9);
    }
  });

  it("never swings the whole field in step under the lights", () => {
    // THE THING A START LINE NEVER LOOKS LIKE. Every hull is in its own
    // water, under its own eddy (`TUNING.wind.eddyScale`), with its own
    // rider on it (`RACE.riderBand`) — so what the field does about its
    // heading has to be twelve answers and not one. Read as the spread
    // ACROSS the craft against the mean of it: a field all turning together
    // is a big mean over a small spread.
    for (const seed of [7, 12, 101]) {
      const state = createGame({ seed, mode: "race", quiet: true });
      const rates: number[][] = [];
      while (state.phase === "countdown") {
        step(state, COAST);
        rates.push([state.craft, ...state.rivals.map((r) => r.run.craft)].map((c) => c.wy));
      }
      expect(rates.length).toBeGreaterThan(100);
      const worst = Math.max(
        ...rates.map((row) => {
          const mean = row.reduce((a, b) => a + b, 0) / row.length;
          const spread = Math.sqrt(row.reduce((a, b) => a + (b - mean) ** 2, 0) / row.length);
          // Every hull turning at once, as a multiple of how differently
          // they do it. Guarded so a field standing still is not a
          // division by nothing.
          return Math.abs(mean) / Math.max(spread, 1e-6);
        }),
      );
      expect(worst, `seed ${seed}`).toBeLessThan(12);
      // ...and nothing is spinning: a hull holding station on the water
      // turns at the pace weather turns it, not at a rate a rider would
      // have to catch.
      for (const row of rates) for (const wy of row) expect(Math.abs(wy)).toBeLessThan(0.6);
    }
  });

  it("puts a rider of his own weight on every rival, and the catalog's on the player", () => {
    const state = createGame({ seed: 38, craft: "marlin", mode: "race", quiet: true });
    const nominal = craftById("marlin").riderMass;
    expect(state.craft.spec.riderMass).toBe(nominal);
    // Each rival rides the next hull in the catalog, so each one's band is
    // read off ITS OWN nominal rider rather than off one shared number.
    const riders = state.rivals.map((r) => r.run.craft.spec.riderMass);
    for (const rival of state.rivals) {
      const kg = rival.run.craft.spec.riderMass;
      const own = craftById(rival.run.craft.spec.id).riderMass;
      expect(kg).toBeGreaterThanOrEqual(own * RACE.riderBand.min - 1e-9);
      expect(kg).toBeLessThanOrEqual(own * RACE.riderBand.max + 1e-9);
    }
    // Twelve different people, not twelve copies of one.
    expect(new Set(riders.map((kg) => kg.toFixed(3))).size).toBe(riders.length);
    const spread = Math.max(...riders) - Math.min(...riders);
    expect(spread).toBeGreaterThan(15);
  });
});

describe("a race", () => {
  it("stands eleven rivals on the roster over the same sea, and they ride", () => {
    const state = createGame({ seed: 2, level: FLAT, mode: "race", quiet: true });
    expect(state.rivals).toHaveLength(RACE.rivals);
    const ids = new Set(state.rivals.map((r) => r.run.craft.spec.id));
    expect(ids.size).toBe(4);
    for (const r of state.rivals) {
      expect(r.run.level).toBe(state.level);
      expect(r.run.sea).toBe(state.sea);
      expect(r.run.rules).toBe(state.rules);
      expect(r.pace).toBeGreaterThanOrEqual(RACE.paceBand.min);
      expect(r.pace).toBeLessThanOrEqual(RACE.paceBand.max);
    }
    const before = state.rivals.map((r) => r.run.craft.x);
    ride(state, RACE.countdown + 8, (s) => botInput(s));
    expect(state.phase).toBe("running");
    state.rivals.forEach((r, i) => {
      expect(r.run.craft.x - before[i], `rival ${i}`).toBeGreaterThan(40);
      expect(Number.isFinite(r.run.craft.y)).toBe(true);
    });
    const place = racePlace(state);
    expect(place).toBeGreaterThanOrEqual(1);
    expect(place).toBeLessThanOrEqual(RACE.rivals + 1);
  });

  it("reads the player at the BACK of the grid, level with the two beside him", () => {
    const state = createGame({ seed: 2, level: FLAT, mode: "race", quiet: true });
    // Every row ahead of his is ahead of him; the two on his own row are
    // neither ahead nor behind, so he is tenth of twelve and not first.
    expect(racePlace(state)).toBe(RACE.rivals + 1 - (RACE.grid.abreast - 1));
  });

  it("is the same race twice from the same seed", () => {
    const a = createGame({ seed: 3, level: FLAT, mode: "race", quiet: true });
    const b = createGame({ seed: 3, level: FLAT, mode: "race", quiet: true });
    ride(a, RACE.countdown + 6, (s) => botInput(s));
    ride(b, RACE.countdown + 6, (s) => botInput(s));
    expect(a.rivals.map((r) => [r.pace, r.run.craft.x, r.run.craft.z])).toEqual(
      b.rivals.map((r) => [r.pace, r.run.craft.x, r.run.craft.z]),
    );
    expect(a.craft.x).toBe(b.craft.x);
  });

  it("lets one hull lean on another: a shove is felt, the other moves, momentum crosses", () => {
    const state = createGame({
      seed: 2,
      level: FLAT,
      mode: "race",
      rules: { countdown: 0 },
      quiet: true,
    });
    // Everybody but one rival out of the way, that one stood still four
    // metres ahead, and the player driven into its transom at ten.
    state.rivals.forEach((r, i) => standCraft(r.run, 400 + i * 20, 300, 0));
    const other = state.rivals[0].run;
    standCraft(other, 104, 200, Math.PI / 2);
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 10 });
    const mine = state.craft.spec.mass + state.craft.spec.riderMass;
    const theirs = other.craft.spec.mass + other.craft.spec.riderMass;
    const momentum = mine * state.craft.vx;
    const events = ride(state, 0.3);
    const bump = events.find((e) => e.kind === "bump");
    expect(bump?.kind === "bump" && bump.rival).toBe(0);
    expect(bump?.kind === "bump" && bump.speed).toBeGreaterThan(RACE.bump.speed);
    expect(other.craft.vx).toBeGreaterThan(1);
    expect(state.craft.vx).toBeLessThan(10);
    // Along the line of the hit, most of the momentum is still there — the
    // water's drag over a third of a second and the barge's toll take some,
    // and the player's engine, still pulling off the placement, adds a
    // little — so the sum is bounded loosely on both sides rather than
    // asserted conserved.
    const after = mine * state.craft.vx + theirs * other.craft.vx;
    expect(after).toBeGreaterThan(momentum * 0.6);
    expect(after).toBeLessThan(momentum * 1.3);
    // ...and they are no longer inside each other.
    expect(
      Math.hypot(other.craft.x - state.craft.x, other.craft.z - state.craft.z),
    ).toBeGreaterThan((state.craft.spec.beam + other.craft.spec.beam) / 2);
  });

  it("lets every hull pass through every other with the contact rule off", () => {
    // The campaign's field: on the water, never leaned on. The same shove
    // as above, and nothing is felt, nothing moves, nothing is reported.
    const state = createGame({
      seed: 2,
      level: FLAT,
      mode: "race",
      rules: { countdown: 0, contact: false },
      quiet: true,
    });
    expect(state.rules.contact).toBe(false);
    expect(state.rivals.length).toBe(RACE.rivals);
    state.rivals.forEach((r, i) => standCraft(r.run, 400 + i * 20, 300, 0));
    const other = state.rivals[0].run;
    standCraft(other, 104, 200, Math.PI / 2);
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 10 });
    const events = ride(state, 0.3);
    expect(events.some((e) => e.kind === "bump")).toBe(false);
    // The other hull has only its own idling jet under it (a metre a
    // second, not the shove's several), and the player's speed is the
    // water's toll and nothing else.
    expect(other.craft.vx).toBeLessThan(1);
    expect(state.craft.vx).toBeGreaterThan(5);
  });

  it("orders a field with the course switched off by the SCORE, and files the whole field", () => {
    // A tricks run with a grid on it (the campaign's second discipline): the
    // buzzer ends it for everybody at once, so the standings are what each
    // rider banked. `fieldOrder` is the whole sheet; `racePlace` is the
    // player's row of it.
    const state = createGame({
      seed: 3,
      level: FLAT,
      mode: "tricks",
      rules: { countdown: 0, rivals: 3, contact: false },
      quiet: true,
    });
    expect(state.rules.course).toBe(false);
    state.tricks.score = 500;
    state.rivals[0].run.tricks.score = 900;
    state.rivals[1].run.tricks.score = 100;
    state.rivals[2].run.tricks.score = 700;
    expect(racePlace(state)).toBe(3);
    expect(fieldOrder(state)).toEqual([0, 2, null, 1]);
    // ...and on a race the same reading is by the course, with the player
    // at the back of a field that is all a gate ahead of him.
    const race = createGame({
      seed: 2,
      level: FLAT,
      mode: "race",
      rules: { countdown: 0, rivals: 2 },
      quiet: true,
    });
    for (const r of race.rivals)
      placeRun(r.run, { x: 350, z: 40, heading: Math.PI / 2, nextGate: 3 });
    placeRun(race, { x: 150, z: 40, heading: Math.PI / 2, speed: 10, nextGate: 1 });
    expect(fieldOrder(race).indexOf(null)).toBe(2);
  });

  it("does not count a hull flying over another as a contact", () => {
    const state = createGame({
      seed: 2,
      level: FLAT,
      mode: "race",
      rules: { countdown: 0 },
      quiet: true,
    });
    state.rivals.forEach((r, i) => standCraft(r.run, 400 + i * 20, 300, 0));
    const other = state.rivals[0].run;
    standCraft(other, 102, 200, Math.PI / 2);
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 12, height: 3, vy: 6 });
    step(state, COAST);
    step(state, COAST);
    expect(state.events.some((e) => e.kind === "bump")).toBe(false);
    expect(other.craft.speed).toBeLessThan(0.1);
  });

  it("places the player against the field, and a finish carries the place", () => {
    const state = createGame({
      seed: 2,
      level: FLAT,
      mode: "race",
      rules: { countdown: 0 },
      quiet: true,
    });
    // The field parked at the start line; the player two gates down the
    // course is first.
    placeRun(state, { x: 250, z: 40, heading: Math.PI / 2, speed: 10, nextGate: 2 });
    expect(racePlace(state)).toBe(1);
    // ...and last, with every rival a gate ahead of him.
    for (const r of state.rivals)
      placeRun(r.run, { x: 350, z: 40, heading: Math.PI / 2, nextGate: 3 });
    placeRun(state, { x: 150, z: 40, heading: Math.PI / 2, speed: 10, nextGate: 1 });
    expect(racePlace(state)).toBe(RACE.rivals + 1);
    // Two rivals home: the player crossing the last gate is third.
    for (const r of state.rivals.slice(0, 2)) {
      r.run.progress.finished = true;
      r.run.progress.time = 50;
      r.run.phase = "finished";
    }
    const last = FLAT.course.gates[FLAT.course.gates.length - 1];
    placeRun(state, {
      x: last.x - 10,
      z: last.z,
      heading: Math.PI / 2,
      speed: 15,
      nextGate: last.index,
    });
    const events = ride(state, 2, () => FLAT_OUT);
    const finish = events.find((e) => e.kind === "finish");
    expect(finish?.kind === "finish" && finish.place).toBe(3);
  });
});
