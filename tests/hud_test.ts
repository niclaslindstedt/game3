// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE HUD READS — the payload the readouts are drawn from
// (pwa/src/game/snapshot.ts), taken off a run rather than off a mock, so a
// claim here is a claim about what a rider actually sees.
//
// The air clock is the one readout on that screen with a rule of its own:
// the hull is clear of the water a fifth of the steps in a head sea, and a
// clock that started for every one of those would flicker over the horizon
// all run. It starts at `flight.airCounts` instead — a hop is not air time
// — and the state's own `airborne` stays honest beside it.
//
// Two more things ride on it, and both are the SNAPSHOT's rather than the
// styling's: how big the clock is drawn (`airGrow`, so a rider reading the
// shape of the thing knows whether this one is big) and whether it is
// showing a record (`airRecord`, which covers the flight already past the
// run's best AND the moment it is held on screen after the landing that
// took it). The hold is measured off the engine's `progress.bestAirAt`, so
// the claim "the HUD keeps no clock of its own" is testable here.

import { describe, expect, it } from "vitest";
import {
  RACE,
  TUNING,
  biomeOf,
  createGame,
  placeRun,
  sampleField,
  step,
  type CraftInput,
  type GameState,
  type Level,
  type TrickPart,
} from "@engine";

import { skyAt } from "../pwa/src/game/sky.ts";
import { ALT_ZERO, altitudeShare, takeSnapshot } from "../pwa/src/game/snapshot.ts";
import { STRINGS } from "../pwa/src/game/strings.ts";
import { syntheticLevel } from "./support/synthetic.ts";

const FLAT = syntheticLevel({ windSpeed: 0, noSolids: true });
const COAST: CraftInput = { steer: 0, throttle: 0, reverse: 0, lean: 0, crouch: 0, reset: false };

/** A flight staged from `height` m over calm water with `vy` m/s of climb,
 * read every step: the clock the HUD would have shown, against the flight
 * the hull was actually on. */
function clockThroughFlight(height: number, vy: number): { airTime: number; clock: number }[] {
  const state = createGame({ seed: 1, craft: "skiff", level: FLAT, quiet: true });
  placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 15, height, vy });
  const read: { airTime: number; clock: number }[] = [];
  while (state.craft.airborne) {
    read.push({ airTime: state.craft.airTime, clock: takeSnapshot(state).airTime });
    step(state, COAST);
  }
  return read;
}

/** The whole air readout at this instant, beside the hull's own truth. */
function airRead(state: GameState): {
  clock: number;
  grow: number;
  record: boolean;
  airborne: boolean;
} {
  const snap = takeSnapshot(state);
  return {
    clock: snap.airTime,
    grow: snap.airGrow,
    record: snap.airRecord,
    airborne: state.craft.airborne,
  };
}

/** A flight staged from `height` m over calm water with `vy` m/s of climb,
 * read every step to the water and for `after` seconds past it — which is
 * where the record's hold lives. */
function airThroughFlight(
  height: number,
  vy: number,
  after: number,
  state = createGame({ seed: 1, craft: "skiff", level: FLAT, quiet: true }),
): ReturnType<typeof airRead>[] {
  placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 15, height, vy });
  const read: ReturnType<typeof airRead>[] = [];
  while (state.craft.airborne) {
    read.push(airRead(state));
    step(state, COAST);
  }
  const until = state.t + after;
  while (state.t < until) {
    read.push(airRead(state));
    step(state, COAST);
  }
  return read;
}

describe("the air clock", () => {
  it("does not start until the flight has lasted long enough to be one", () => {
    const read = clockThroughFlight(1.5, 6);
    const line = TUNING.flight.airCounts;
    expect(read.some((r) => r.airTime > line)).toBe(true);
    for (const r of read) expect(r.clock).toBe(r.airTime > line ? r.airTime : 0);
  });

  it("reads the WHOLE flight once it counts, not the part past the line", () => {
    const read = clockThroughFlight(1.5, 6);
    const first = read.find((r) => r.clock > 0)!;
    expect(first.clock).toBeGreaterThan(TUNING.flight.airCounts);
    expect(first.clock).toBeLessThan(TUNING.flight.airCounts + 0.05);
    expect(read[read.length - 1].clock).toBeGreaterThan(1);
  });

  it("leaves a hop unread, and the hull's own airborne flag honest", () => {
    // Dropped 1.2 m with no climb: clear of the water for about 0.41 s.
    const read = clockThroughFlight(1.2, 0);
    expect(read.length).toBeGreaterThan(0);
    expect(read.every((r) => r.airTime < TUNING.flight.airCounts)).toBe(true);
    expect(read.every((r) => r.clock === 0)).toBe(true);
  });
});

describe("how big the air clock is drawn", () => {
  it("starts at nothing and grows with the flight, never past the whole size", () => {
    const read = airThroughFlight(30, 10, 0).filter((r) => r.clock > 0);
    // The first step past the line is one step's worth of growth, not a jump:
    // half a second in the air is not news.
    expect(read[0].grow).toBeLessThan(0.01);
    for (let i = 1; i < read.length; i++) {
      expect(read[i].grow).toBeGreaterThan(read[i - 1].grow);
      expect(read[i].grow).toBeLessThanOrEqual(1);
    }
  });

  it("spends most of its size on the flights a rider actually flies", () => {
    // Two staged flights, one about a second and a half and one about four,
    // against the same line. The size has to separate them plainly — a ramp
    // that saved its growth for the seconds only the ocean deals would leave
    // both of them looking the same.
    const hop = airThroughFlight(1.5, 6, 0)
      .filter((r) => r.clock > 0)
      .pop()!;
    const jump = airThroughFlight(30, 10, 0)
      .filter((r) => r.clock > 0)
      .pop()!;
    expect(hop.clock).toBeLessThan(1.5);
    expect(jump.clock).toBeGreaterThan(3.5);
    expect(hop.grow).toBeLessThan(0.2);
    expect(jump.grow).toBeGreaterThan(0.4);
    // ...and neither is finished: the whole size belongs to a flight no ramp
    // on the course can throw, so there is somewhere left to go.
    expect(jump.grow).toBeLessThan(0.8);
  });
});

describe("the run's best on the air clock", () => {
  it("says so while the flight is still up, once it has passed the best", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: FLAT, quiet: true });
    state.progress.bestAir = 1;
    state.progress.bestAirAt = -1000;
    const read = airThroughFlight(30, 10, 0, state).filter((r) => r.airborne && r.clock > 0);
    for (const r of read) expect(r.record).toBe(r.clock > 1);
    expect(read.some((r) => r.record)).toBe(true);
  });

  it("holds the winning number on screen after the landing, then lets it go", () => {
    const read = airThroughFlight(
      30,
      10,
      4,
      createGame({
        seed: 1,
        craft: "skiff",
        level: FLAT,
        quiet: true,
      }),
    );
    const flown = read.filter((r) => r.airborne).pop()!.clock;
    const held = read.filter((r) => !r.airborne && r.clock > 0);
    expect(held.length).toBeGreaterThan(0);
    // The clock STOPS at the flight it is reporting rather than running on,
    // and the word is beside it the whole time it is held.
    for (const r of held) {
      expect(r.clock).toBeCloseTo(flown, 6);
      expect(r.record).toBe(true);
    }
    // ...and it is gone well before the end of the four seconds ridden on.
    const last = read[read.length - 1];
    expect(last.clock).toBe(0);
    expect(last.record).toBe(false);
  });

  it("leaves a flight that beat nothing without the word", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: FLAT, quiet: true });
    state.progress.bestAir = 30;
    state.progress.bestAirAt = -1000;
    const read = airThroughFlight(30, 10, 1, state);
    expect(read.some((r) => r.clock > 0)).toBe(true);
    expect(read.every((r) => !r.record)).toBe(true);
  });
});

// ── THE NIGHT DRESSING ───────────────────────────────────────────────────
// How far the HUD's chrome is dipped (`dark`) is the one number the night
// dressing in styles.css turns on, and the whole of its correctness is
// WHICH switch it is wired to. Two claims, and the second is the one that
// was got wrong first: it is the craft's own lamp, and it is NOT the word
// under the clock.

/** A run standing on the synthetic coast at `hour`, in `season`. */
function atHour(hour: number, season: Level["season"] = "winter"): GameState {
  const level = { ...syntheticLevel({ windSpeed: 0, noSolids: true }), hour, season };
  return createGame({ seed: 1, craft: "skiff", level, quiet: true });
}

/** The synthetic coast's latitude — the same one the snapshot reads. */
const LAT = biomeOf(syntheticLevel().biome).latitude;

describe("how far the chrome is dipped", () => {
  it("is the craft's own lamp switch, to the last digit the HUD can use", () => {
    for (const hour of [6, 8, 10, 12, 14, 15, 15.5, 16, 17, 22]) {
      const state = atHour(hour);
      const lamps = skyAt(hour, LAT, state.level.weather, 0, state.level.season).lamps;
      // Quantised to a hundredth on the way into the snapshot; nothing else
      // about it may differ from the light the rider is riding by.
      expect(takeSnapshot(state).dark).toBeCloseTo(Math.round(lamps * 100) / 100, 10);
    }
  });

  it("leaves the chrome alone with the sun up and dips it fully once it is down", () => {
    expect(takeSnapshot(atHour(12, "summer")).dark).toBe(0);
    expect(takeSnapshot(atHour(22, "winter")).dark).toBe(1);
  });

  it("never steps: the lamp is a dimmer here, so the cluster is one too", () => {
    const read = [];
    for (let hour = 14; hour <= 17; hour += 0.1) read.push(takeSnapshot(atHour(hour)).dark);
    // Monotone down into the evening, and no single tenth of an hour moves
    // it more than a fifth of the way — a HUD that switched would.
    for (let i = 1; i < read.length; i++) {
      expect(read[i]).toBeGreaterThanOrEqual(read[i - 1]);
      expect(read[i] - read[i - 1]).toBeLessThan(0.2);
    }
    expect(read[0]).toBe(0);
    expect(read[read.length - 1]).toBe(1);
  });

  it("is NOT the word under the clock: a winter noon at 62°N reads DUSK in full daylight", () => {
    const snap = takeSnapshot(atHour(12, "winter"));
    expect(snap.daylight).toBe("dusk");
    expect(snap.dark).toBe(0);
  });
});

/** THE TRICK VOCABULARY — the words the combo line is built from, and the
 * one place in the app where the engine's elements become English
 * (`pwa/src/game/strings.ts`, §39.1). Read here rather than in
 * `tricks_test.ts` because none of it is the engine's: the engine names the
 * THING and counts the revolutions, and every judgement about what to call
 * the result is made in the table. */
describe("the combo's line", () => {
  const part = (kind: TrickPart["kind"], spins = 1, flight = 0): TrickPart => ({
    kind,
    spins,
    flight,
  });

  it("names each element and joins them in the order they were won", () => {
    expect(STRINGS.comboLine([part("air"), part("backflip")])).toBe("AIR + BACKFLIP");
    expect(STRINGS.comboLine([part("air"), part("roll")])).toBe("AIR + BARREL ROLL");
    expect(STRINGS.comboLine([])).toBe("");
  });

  it("spells the revolution count, and falls back to a figure past a quad", () => {
    expect(STRINGS.comboLine([part("backflip", 2)])).toBe("DOUBLE BACKFLIP");
    expect(STRINGS.comboLine([part("roll", 3)])).toBe("TRIPLE BARREL ROLL");
    expect(STRINGS.comboLine([part("frontflip", 5)])).toBe("5× FRONTFLIP");
  });

  it("calls a flip and a roll turned in ONE flight a corkscrew, once", () => {
    const line = STRINGS.comboLine([part("air"), part("backflip"), part("roll")]);
    expect(line).toBe("AIR + CORKSCREW");
  });

  it("...and does not, when they were taken off two waves in a row", () => {
    // The same two elements in the same combo, one flight apart. It is a
    // link, not a corkscrew, and the line has to say so — which is the
    // whole reason an element carries which flight it was won in.
    const line = STRINGS.comboLine([part("air"), part("backflip", 1, 0), part("roll", 1, 1)]);
    expect(line).toBe("AIR + BACKFLIP + BARREL ROLL");
  });

  it("...and does not collapse a flight with a DOUBLE in it", () => {
    // Two harder things read better as two: the compound is for the one
    // trick that earns a name of its own, not for anything with a roll in
    // it.
    const line = STRINGS.comboLine([part("backflip", 1), part("backflip", 2), part("roll", 1)]);
    expect(line).toBe("BACKFLIP + DOUBLE BACKFLIP + BARREL ROLL");
  });

  it("is what a run actually produces: a rolled jump reads back off the snapshot", () => {
    // End to end, off the engine rather than off a hand-built list — the
    // claim is that what the HUD draws is what the rider just did: he threw
    // the bars over in a jump, so the line opens with the air he did it in
    // and names the roll.
    //
    // Asserted on the OPENING of the line and not the whole of it. How many
    // revolutions a held throw is worth is `TUNING.flight.whip`'s to say
    // and it is tuned against `make ride` (a stand-up on a nine-metre-a-
    // second launch turns one and a half); pinning the count here would
    // make this case fail every time that dial legitimately moves, and the
    // count is not what it is about.
    const state = createGame({ seed: 1, craft: "dart", level: FLAT, quiet: true });
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 18, height: 1.5, vy: 9 });
    let parts: readonly TrickPart[] = [];
    for (let i = 0; i < 3 * TUNING.physicsHz; i++) {
      step(state, { steer: 1, throttle: 0, reverse: 0, lean: 0, crouch: 0, reset: false });
      const snap = takeSnapshot(state);
      if (snap.comboParts.length > 0) parts = snap.comboParts;
    }
    expect(parts.map((p) => p.kind).slice(0, 2)).toEqual(["air", "roll"]);
    expect(STRINGS.comboLine(parts).startsWith("AIR + BARREL ROLL")).toBe(true);
    // ...and nothing he did not do: the bars were never hauled back.
    expect(parts.some((p) => p.kind === "backflip" || p.kind === "frontflip")).toBe(false);
  });
});

// THE ALTIMETER (`CraftState.altitude`, `progress.peakAltitude`). Its whole
// design is in its DATUM: it measures from the still-water plane, not from
// the water under the hull, so the sea itself registers on it. That is what
// the first two cases are about, and it is the difference between a readout
// that answers "how far up does the open ocean throw me" and one that reads
// zero all the way over a ten-metre face.
describe("the altimeter", () => {
  it("reads zero at rest on a flat calm, whatever the hull draws", () => {
    // The datum is per-hull — the dart floats a different depth from the
    // otter — so a chip reading anything but 0 on still water would be
    // reading the craft rather than the water.
    for (const craft of ["skiff", "marlin", "otter", "dart"] as const) {
      const state = createGame({ seed: 1, craft, level: FLAT, quiet: true });
      placeRun(state, { x: 100, z: 200, heading: Math.PI / 2 });
      for (let i = 0; i < TUNING.physicsHz; i++) step(state, COAST);
      expect(Math.abs(takeSnapshot(state).altitude)).toBeLessThan(0.15);
    }
  });

  it("swings with the sea on a hull that never leaves the water", () => {
    // A running sea and the throttle shut: the hull is riding, not flying,
    // and the meter has to be moving. Both signs — a trough is a place a
    // rider is genuinely below the plane he measures from, and the swing
    // between the two IS how big the sea is.
    const sea = syntheticLevel({ windSpeed: 14, noSolids: true });
    const state = createGame({ seed: 3, craft: "otter", level: sea, quiet: true });
    placeRun(state, { x: 100, z: 340, heading: Math.PI / 2 });
    let low = Infinity;
    let high = -Infinity;
    for (let i = 0; i < 30 * TUNING.physicsHz; i++) {
      step(state, COAST);
      const alt = takeSnapshot(state).altitude;
      low = Math.min(low, alt);
      high = Math.max(high, alt);
    }
    expect(low).toBeLessThan(-0.2);
    expect(high).toBeGreaterThan(0.2);
  });

  it("reads the whole climb in a flight, apex included", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: FLAT, quiet: true });
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 15, height: 1, vy: 9 });
    let top = -Infinity;
    while (state.craft.airborne) {
      top = Math.max(top, state.craft.altitude);
      step(state, COAST);
    }
    // Ballistic from 9 m/s is a little over four metres of climb on top of
    // the metre it was launched from; the assertion is the ORDER, not the
    // figure, since the air's drag is `flight.ts`'s to tune.
    expect(top).toBeGreaterThan(4);
    expect(top).toBeLessThan(8);
  });

  it("keeps the run's peak, which the apex is too brief to be read at", () => {
    // The point of the peak: the snapshot is taken about twelve times a
    // second and the top of a jump is one instant, so the run keeps the
    // best of the physics rate and the chip reads that back.
    const state = createGame({ seed: 1, craft: "skiff", level: FLAT, quiet: true });
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 15, height: 1, vy: 9 });
    let sampled = -Infinity;
    for (let i = 0; i < 6 * TUNING.physicsHz; i++) {
      step(state, COAST);
      if (i % 10 === 0) sampled = Math.max(sampled, takeSnapshot(state).altitude);
    }
    expect(state.progress.peakAltitude).toBeGreaterThanOrEqual(sampled);
    expect(state.progress.peakAltitude).toBeGreaterThan(4);
  });

  it("holds the high-water tick back until the run has been somewhere worth marking", () => {
    // Nothing on the track on the water, and a tick once a jump has cleared
    // the floor — so the tape gains its mark on the first real flight and on
    // no amount of chop.
    const state = createGame({ seed: 1, craft: "skiff", level: FLAT, quiet: true });
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2 });
    for (let i = 0; i < TUNING.physicsHz; i++) step(state, COAST);
    expect(takeSnapshot(state).altitudePeakShare).toBeLessThan(0);

    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: 15, height: 1, vy: 9 });
    for (let i = 0; i < 6 * TUNING.physicsHz; i++) step(state, COAST);
    const snap = takeSnapshot(state);
    // ...and it stands where the run's best was, not where the craft is:
    // back on the water, the marker has come home and the tick has not.
    expect(state.craft.airborne).toBe(false);
    expect(snap.altitudePeakShare).toBe(altitudeShare(state.progress.peakAltitude));
    expect(snap.altitudePeakShare).toBeGreaterThan(snap.altitudeShare);
  });
});

describe("the wind meter", () => {
  it("reads the local wind at the craft and turns relative to its nose", () => {
    const level = syntheticLevel({ windSpeed: 9, windFrom: 0, noSolids: true });
    const state = createGame({ seed: 1, craft: "skiff", level, quiet: true });
    placeRun(state, { x: 100, z: 40, heading: 0 });
    const north = takeSnapshot(state);

    // Moving the craft makes the meter sample the new point rather than
    // carrying the level's headline wind as a fixed HUD value.
    placeRun(state, { x: 400, z: 350, heading: 0 });
    const offshore = takeSnapshot(state);
    expect(offshore.windMs).toBeGreaterThan(0);
    expect(offshore.windMs).not.toBe(north.windMs);

    // At the same point the world wind has not turned; only the craft has.
    // Its screen bearing moves a quarter turn clockwise with the new nose,
    // which is what the arrow beside the altimeter animates between.
    placeRun(state, { x: 400, z: 350, heading: Math.PI / 2 });
    const east = takeSnapshot(state);
    expect(east.windMs).toBeCloseTo(offshore.windMs, 9);
    expect(east.windAngle - offshore.windAngle).toBeCloseTo(Math.PI / 2, 6);
  });
});

// THE TAPE'S SCALE. The marker's TRAVEL is compressed and the figure beside
// it is not, so these are claims about what the shape says, never about what
// the rider reads: the number is `craft.altitude` to a decimal at every
// height on here.
describe("where the altimeter's marker sits", () => {
  it("stands the still-water line off the foot, so a trough has somewhere to go", () => {
    expect(altitudeShare(0)).toBe(ALT_ZERO);
    expect(ALT_ZERO).toBeGreaterThan(0.05);
    expect(altitudeShare(-1)).toBeLessThan(ALT_ZERO);
    expect(altitudeShare(-1)).toBeGreaterThan(0);
  });

  it("never leaves the track at either end, however deep or however high", () => {
    for (const m of [-400, -40, -8, 0, 0.5, 12, 150, 4000]) {
      expect(altitudeShare(m)).toBeGreaterThanOrEqual(0);
      expect(altitudeShare(m)).toBeLessThanOrEqual(1);
    }
  });

  it("rises with the height and never falls back", () => {
    let last = -1;
    for (let m = -12; m <= 120; m += 0.25) {
      const at = altitudeShare(m);
      expect(at).toBeGreaterThanOrEqual(last);
      last = at;
    }
  });

  it("spends most of the track on the heights a rider actually reaches", () => {
    // A ten-metre jump is most of the way up; the rest of the tape is the
    // tornado's, which is a height nothing but the tornado reaches. Without
    // the knee a four-metre launch — a good one off a ramp — would move the
    // marker a few pixels and read as nothing happening.
    const jump = altitudeShare(10) - ALT_ZERO;
    const beyond = altitudeShare(100) - altitudeShare(10);
    expect(jump).toBeGreaterThan(beyond * 2);
    expect(altitudeShare(4) - ALT_ZERO).toBeGreaterThan(0.2);
  });
});

describe("course feedback", () => {
  it("uses the whole checkpoint warning and reads the distance back to it", () => {
    expect(STRINGS.missed).toBe("MISSED CHECKPOINT");
    const state = createGame({ seed: 1, craft: "skiff", level: FLAT, quiet: true });
    const gate = FLAT.course.gates[0];
    state.progress.activeMissedGate = gate.index;
    placeRun(state, { x: gate.x + 30, z: gate.z + 40, heading: gate.heading });
    expect(takeSnapshot(state).missedDistance).toBeCloseTo(50, 6);
    expect(STRINGS.missedBack(49.6)).toBe("50 M BACK");
  });
});

describe("how far out he is", () => {
  /** The synthetic level's `offshore` field is simply z (support/synthetic.ts),
   * so a craft standing at a known z has a known distance from the shore and
   * the reading can be checked against the metre rather than against itself. */
  it("reads the level's own offshore field at the craft, in metres", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: FLAT, quiet: true });
    for (const z of [40, 175, 320]) {
      placeRun(state, { x: 100, z, heading: Math.PI / 2 });
      expect(takeSnapshot(state).shoreDistance).toBeCloseTo(z, 3);
    }
  });

  it("never goes negative: a hull up on the sand is AT the shore, not behind it", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: FLAT, quiet: true });
    // The field is signed and runs negative inland; the readout is a
    // distance FROM the shore, and there is no such thing as −20 m of it.
    placeRun(state, { x: 100, z: 20, heading: Math.PI / 2 });
    state.craft.z = -20;
    expect(sampleField(FLAT.offshore, state.craft.x, state.craft.z)).toBeLessThan(0);
    expect(takeSnapshot(state).shoreDistance).toBe(0);
  });

  it("is written in whole metres, because the figure runs at riding speed", () => {
    expect(STRINGS.shore(1231.6)).toBe("1232 m");
    expect(STRINGS.shore(0)).toBe("0 m");
    expect(STRINGS.shoreLabel).toBe("FROM SHORE");
  });
});

describe("what the HUD reads of the mode", () => {
  it("shows the lights while they hold, GO for a moment after, and nothing on the open rules", () => {
    const race = createGame({ seed: 1, level: FLAT, mode: "timeTrial", quiet: true });
    expect(takeSnapshot(race).countdown).toBe(RACE.countdown);
    expect(takeSnapshot(race).go).toBe(false);
    for (let i = 0; i < 1.2 * TUNING.physicsHz; i++) step(race, COAST);
    expect(takeSnapshot(race).countdown).toBe(2);
    while (race.phase === "countdown") step(race, COAST);
    const snap = takeSnapshot(race);
    expect(snap.countdown).toBe(0);
    expect(snap.go).toBe(true);
    for (let i = 0; i < 1.5 * TUNING.physicsHz; i++) step(race, COAST);
    expect(takeSnapshot(race).go).toBe(false);

    const open = createGame({ seed: 1, level: FLAT, quiet: true });
    expect(takeSnapshot(open).countdown).toBe(0);
    expect(takeSnapshot(open).go).toBe(false);
  });

  it("counts a timed run DOWN, and leaves the course off it", () => {
    const state = createGame({
      seed: 1,
      level: FLAT,
      mode: "tricks",
      rules: { limit: 30 },
      quiet: true,
    });
    expect(takeSnapshot(state).countdown).toBe(RACE.countdown);
    expect(takeSnapshot(state).left).toBe(30);
    while (state.phase === "countdown") step(state, COAST);
    const before = takeSnapshot(state).left!;
    for (let i = 0; i < 5 * TUNING.physicsHz; i++) step(state, COAST);
    const snap = takeSnapshot(state);
    expect(snap.left).toBeCloseTo(before - 5, 6);
    expect(snap.courseOn).toBe(false);
    expect(snap.tricksOn).toBe(true);
    expect(snap.riders).toBe(1);
  });

  it("reads the gap to the ghost in the run's own currency, and only where there is one", () => {
    // A TRICKS run: the two totals both exist at every instant, so the gap
    // is live and it is POINTS — positive where the rider is up on it.
    const mine = createGame({ seed: 1, level: FLAT, mode: "tricks", quiet: true });
    const ghost = createGame({ seed: 1, level: FLAT, mode: "tricks", quiet: true });
    expect(takeSnapshot(mine).ghostGap).toBeNull();
    expect(takeSnapshot(mine, ghost).ghostGap).toBe(0);
    mine.tricks.score = 1200;
    ghost.tricks.score = 700;
    expect(takeSnapshot(mine, ghost).ghostGap).toBe(500);
    expect(takeSnapshot(ghost, mine).ghostGap).toBe(-500);

    // A COURSE run: a time is only a fact at a gate, so the gap is null
    // until both have crossed the same one and is then that split's.
    const run = createGame({ seed: 1, level: FLAT, mode: "timeTrial", quiet: true });
    const theirs = createGame({ seed: 1, level: FLAT, mode: "timeTrial", quiet: true });
    expect(takeSnapshot(run, theirs).ghostGap).toBeNull();
    run.progress.splits[0] = 12;
    expect(takeSnapshot(run, theirs).ghostGap).toBeNull();
    theirs.progress.splits[0] = 13.5;
    expect(takeSnapshot(run, theirs).ghostGap).toBeCloseTo(1.5, 9);
    // A gate skipped past is never given a split, and the readout carries on
    // reading the last gate both DID cross rather than quietly dying on it.
    run.progress.splits[2] = 30;
    theirs.progress.splits[2] = 28;
    expect(takeSnapshot(run, theirs).ghostGap).toBeCloseTo(-2, 9);
  });

  it("reads the place against the field in a race, and the tricks off", () => {
    const state = createGame({
      seed: 2,
      level: FLAT,
      mode: "race",
      rules: { countdown: 0 },
      quiet: true,
    });
    const snap = takeSnapshot(state);
    expect(snap.riders).toBe(RACE.rivals + 1);
    expect(snap.place).toBeGreaterThanOrEqual(1);
    expect(snap.place).toBeLessThanOrEqual(RACE.rivals + 1);
    expect(snap.left).toBeNull();
    expect(snap.tricksOn).toBe(false);
    expect(snap.courseOn).toBe(true);
    expect(snap.minimap.rivals.length).toBe(RACE.rivals);
  });
});
