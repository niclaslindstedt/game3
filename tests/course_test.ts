// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The course: gates are taken in order by crossing their line the right
// way and ONLY in their turn, a gate crossed outside its opening is charged
// and the run moves on, the splits are the clock at each gate, the last
// gate finishes the run, and a reset stands the craft back behind the last
// gate it took.
import { describe, expect, it } from "vitest";

import {
  NEUTRAL_INPUT,
  TUNING,
  activeMissedCheckpoint,
  bearingToNext,
  botInput,
  createGame,
  crossedGate,
  gatePassPoint,
  placeRun,
  resetPose,
  step,
  type CraftInput,
  type Gate,
  type GameEvent,
  type GameState,
} from "@engine";

import { syntheticLevel } from "./support/synthetic.ts";

const LEVEL = syntheticLevel({ windSpeed: 0, noSolids: true });
const FULL: CraftInput = { steer: 0, throttle: 1, reverse: 0, lean: 0, crouch: 0, reset: false };

function ride(state: GameState, seconds: number, input: (s: GameState) => CraftInput): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < seconds * TUNING.physicsHz && state.phase === "running"; i++) {
    step(state, input(state));
    events.push(...state.events);
  }
  return events;
}

describe("crossing a gate", () => {
  const water: Gate = {
    id: "g",
    index: 0,
    kind: "water",
    x: 100,
    y: 0,
    z: 40,
    heading: Math.PI / 2,
    width: 16,
  };
  const air: Gate = {
    id: "a",
    index: 1,
    kind: "air",
    x: 100,
    y: 4,
    z: 40,
    heading: Math.PI / 2,
    width: 6,
  };
  const rightBuoy: Gate = {
    id: "s",
    index: 0,
    kind: "slalom",
    x: 100,
    y: 0,
    z: 40,
    heading: Math.PI / 2,
    width: 84,
    rounding: "right",
    standoff: 18,
    mark: "B1",
  };

  it("counts a move through the line in the facing direction", () => {
    expect(crossedGate(water, 99, 0, 41, 101, 0, 41)).not.toBeNull();
    expect(crossedGate(water, 99, 0, 47, 101, 0, 47)?.lateral).toBeCloseTo(-7, 6);
  });

  it("ignores the wrong way, a miss to the side, and a move that stays short", () => {
    expect(crossedGate(water, 101, 0, 41, 99, 0, 41)).toBeNull();
    expect(crossedGate(water, 99, 0, 50, 101, 0, 50)).toBeNull();
    expect(crossedGate(water, 90, 0, 40, 99, 0, 40)).toBeNull();
  });

  it("an air gate is a ring: height counts", () => {
    expect(crossedGate(air, 99, 4, 40, 101, 4, 40)).not.toBeNull();
    expect(crossedGate(air, 99, 6.5, 40, 101, 6.5, 40)).not.toBeNull();
    expect(crossedGate(air, 99, 0.5, 40, 101, 0.5, 40)).toBeNull();
    expect(crossedGate(air, 99, 4, 44, 101, 4, 44)).toBeNull();
  });

  it("takes a single-buoy checkpoint only on the side prescribed by its colour", () => {
    // Heading east: north of the can is rider-left, so the can remains on
    // the rider's right. That is the legal side of a yellow/right buoy.
    expect(crossedGate(rightBuoy, 99, 0, 58, 101, 0, 58)?.lateral).toBeCloseTo(-18, 6);
    expect(crossedGate(rightBuoy, 99, 0, 22, 101, 0, 22)).toBeNull();
    // The correct half-plane is finite: this went the right way around but
    // never came close enough to count as rounding the checkpoint.
    expect(crossedGate(rightBuoy, 99, 0, 83, 101, 0, 83)).toBeNull();

    const leftBuoy = { ...rightBuoy, rounding: "left" as const };
    expect(crossedGate(leftBuoy, 99, 0, 22, 101, 0, 22)).not.toBeNull();
    expect(crossedGate(leftBuoy, 99, 0, 58, 101, 0, 58)).toBeNull();
  });

  it("aims at the ideal pass point beside a single buoy", () => {
    expect(gatePassPoint(rightBuoy)).toEqual({ x: 100, z: 58 });
    expect(gatePassPoint({ ...rightBuoy, rounding: "left" })).toEqual({ x: 100, z: 22 });
  });
});

describe("a run", () => {
  it("takes the gates in order with a split at each and finishes at the last", () => {
    const state = createGame({ seed: 1, craft: "marlin", level: LEVEL, quiet: true });
    const events = ride(state, 120, (s) => botInput(s));
    expect(state.phase).toBe("finished");
    const p = state.progress;
    const n = LEVEL.course.gates.length;
    expect(p.passed).toEqual([...Array(n).keys()]);
    expect(p.missed).toEqual([]);
    expect(p.finished).toBe(true);
    for (let i = 1; i < n; i++) expect(p.splits[i]).toBeGreaterThan(p.splits[i - 1]);
    expect(p.splits[n - 1]).toBeCloseTo(p.time, 6);
    expect(p.lastGatePassedAt).toBeCloseTo(p.time, 6);
    const gates = events.filter((e) => e.kind === "gate" || e.kind === "airGate");
    expect(gates.length).toBe(n);
    expect(events.filter((e) => e.kind === "airGate").length).toBe(1);
    const finish = events.find((e) => e.kind === "finish");
    expect(finish).toBeDefined();
    if (finish?.kind === "finish") expect(finish.time).toBeCloseTo(p.time, 6);
    // The clock has stopped.
    const t = p.time;
    for (let i = 0; i < 100; i++) step(state, FULL);
    expect(p.time).toBe(t);
  });

  it("does not count a checkpoint threaded out of turn", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: LEVEL, quiet: true });
    // Stand between G1 (x = 100) and G2 (x = 200), aimed at G2 — cleanly
    // through its opening, and with G1 still owed. A checkpoint is only
    // valid in its turn, so the crossing buys nothing at all: the run has
    // reached no gate, been charged for none, and still owes G1.
    placeRun(state, { x: 150, z: 40, heading: Math.PI / 2, speed: 15 });
    const events = ride(state, 3.5, () => FULL);
    expect(state.craft.x).toBeGreaterThan(LEVEL.course.gates[1].x);
    const p = state.progress;
    expect(p.passed).toEqual([]);
    expect(p.missed).toEqual([]);
    expect(p.nextGate).toBe(0);
    expect(p.penalty).toBe(0);
    expect(events.filter((e) => e.kind === "gate" || e.kind === "missedGate")).toHaveLength(0);
  });

  it("counts none of a whole string of checkpoints ridden out of turn", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: LEVEL, quiet: true });
    // Stand between G2 (x = 200) and G3 (x = 300) with G1 and G2 untaken,
    // and ride through G3 and G4. Riding the rest of the course is not a
    // way of paying for the start of it.
    placeRun(state, { x: 250, z: 40, heading: Math.PI / 2, speed: 15 });
    ride(state, 8, () => FULL);
    expect(state.craft.x).toBeGreaterThan(LEVEL.course.gates[3].x);
    const p = state.progress;
    expect(p.passed).toEqual([]);
    expect(p.missed).toEqual([]);
    expect(p.nextGate).toBe(0);
  });

  it("takes the owed gate when the rider comes back for it", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: LEVEL, quiet: true });
    placeRun(state, { x: 150, z: 40, heading: Math.PI / 2, speed: 15 });
    ride(state, 3.5, () => FULL);
    expect(state.progress.nextGate).toBe(0);
    // Back behind G1 and through it: the gate the run owed all along is
    // taken on its own crossing, in its own turn, at no penalty.
    placeRun(state, { x: 60, z: 40, heading: Math.PI / 2, speed: 15 });
    ride(state, 4, () => FULL);
    const p = state.progress;
    expect(p.passed[0]).toBe(0);
    expect(p.missed).toEqual([]);
    expect(p.penalty).toBe(0);
  });

  it("charges the owed gate and moves on when its line is crossed wide", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: LEVEL, quiet: true });
    const g = LEVEL.course.gates[0];
    // The one way past a checkpoint that is not a way back: crossing its
    // own plane outside its opening pays for it there and then, and the
    // gate after it is live from that step — so the next one IS taken.
    placeRun(state, { x: g.x - 40, z: g.z + 5 * g.width, heading: Math.PI / 2, speed: 15 });
    ride(state, 4, () => FULL);
    expect(state.progress.missed).toEqual([0]);
    expect(state.progress.nextGate).toBe(1);
    placeRun(state, { x: 150, z: 40, heading: Math.PI / 2, speed: 15 });
    ride(state, 4, () => FULL);
    const p = state.progress;
    expect(p.passed).toEqual([1]);
    expect(p.missed).toEqual([0]);
    expect(p.penalty).toBe(TUNING.course.missedPenalty);
    expect(p.time).toBeGreaterThan(TUNING.course.missedPenalty);
  });

  it("misses the owed gate as soon as its line is crossed outside the buoys", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: LEVEL, quiet: true });
    const g = LEVEL.course.gates[0];
    // Past the buoys by five gate-widths, aimed across the gate's own line:
    // the warning belongs at that crossing rather than at the next gate.
    placeRun(state, { x: g.x - 40, z: g.z + 5 * g.width, heading: Math.PI / 2, speed: 15 });
    const events = ride(state, 4, () => FULL);
    expect(state.craft.x).toBeGreaterThan(g.x);
    expect(state.progress.passed).toEqual([]);
    expect(state.progress.missed).toEqual([0]);
    expect(state.progress.nextGate).toBe(1);
    expect(events.filter((e) => e.kind === "missedGate")).toHaveLength(1);
    const active = activeMissedCheckpoint(state);
    expect(active?.gate.index).toBe(0);
    expect(active?.distance).toBeGreaterThan(g.width / 2);
  });

  it("keeps the missed checkpoint active until the craft returns to its opening", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: LEVEL, quiet: true });
    const g = LEVEL.course.gates[0];
    placeRun(state, { x: g.x - 40, z: g.z + 5 * g.width, heading: Math.PI / 2, speed: 15 });
    ride(state, 4, () => FULL);
    expect(state.progress.activeMissedGate).toBe(0);

    placeRun(state, { x: g.x, z: g.z, heading: -Math.PI / 2 });
    step(state, NEUTRAL_INPUT);
    expect(state.progress.activeMissedGate).toBeNull();
    expect(activeMissedCheckpoint(state)).toBeNull();
  });

  it("charges a single-buoy checkpoint crossed on the wrong side", () => {
    const first = LEVEL.course.gates[0];
    const slalom: Gate = {
      ...first,
      kind: "slalom",
      width: 84,
      rounding: "right",
      standoff: 18,
      mark: "B1",
    };
    const level = {
      ...LEVEL,
      course: { ...LEVEL.course, gates: [slalom, ...LEVEL.course.gates.slice(1)] },
    };
    const state = createGame({ seed: 1, craft: "skiff", level, quiet: true });
    placeRun(state, { x: slalom.x - 40, z: slalom.z - 18, heading: Math.PI / 2, speed: 15 });
    const events = ride(state, 4, () => FULL);
    expect(state.progress.passed).toEqual([]);
    expect(state.progress.missed).toEqual([0]);
    expect(events.filter((event) => event.kind === "missedGate")).toHaveLength(1);
  });

  it("still requires the finish to be crossed through its opening", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: LEVEL, quiet: true });
    const g = LEVEL.course.gates.at(-1)!;
    state.progress.nextGate = g.index;
    placeRun(state, { x: g.x - 40, z: g.z + 5 * g.width, heading: Math.PI / 2, speed: 15 });
    const events = ride(state, 4, () => FULL);
    expect(state.craft.x).toBeGreaterThan(g.x);
    expect(state.progress.missed).toEqual([]);
    expect(state.progress.nextGate).toBe(g.index);
    expect(events.some((e) => e.kind === "missedGate" || e.kind === "finish")).toBe(false);
  });

  it("the bearing to the next gate reads right", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: LEVEL, quiet: true });
    const b = bearingToNext(state)!;
    expect(b.bearing).toBeCloseTo(Math.PI / 2, 3);
    expect(Math.abs(b.error)).toBeLessThan(0.01);
    expect(b.distance).toBeCloseTo(80, 3);
  });
});

describe("reset", () => {
  it("from the line stands the craft back at the start", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: LEVEL, quiet: true });
    ride(state, 2, () => FULL);
    expect(state.craft.x).toBeGreaterThan(25);
    step(state, { ...NEUTRAL_INPUT, reset: true });
    const reset = state.events.find((e) => e.kind === "reset");
    expect(reset).toBeDefined();
    if (reset?.kind === "reset") expect(reset.gate).toBe(-1);
    expect(state.craft.x).toBeCloseTo(LEVEL.start.x, 6);
    expect(state.craft.z).toBeCloseTo(LEVEL.start.z, 6);
    expect(state.craft.speed).toBe(0);
    expect(state.craft.heading).toBeCloseTo(LEVEL.start.heading, 6);
  });

  it("after a gate stands the craft behind that gate, facing the next", () => {
    const state = createGame({ seed: 1, craft: "marlin", level: LEVEL, quiet: true });
    for (let i = 0; i < 30 * TUNING.physicsHz && state.progress.passed.length < 2; i++) {
      step(state, botInput(state));
    }
    expect(state.progress.passed).toEqual([0, 1]);
    const pose = resetPose(state);
    expect(pose.gate).toBe(1);
    const g = LEVEL.course.gates[1];
    expect(pose.x).toBeCloseTo(g.x - TUNING.course.resetBack, 6);
    expect(pose.z).toBeCloseTo(g.z, 6);
    step(state, { ...NEUTRAL_INPUT, reset: true });
    expect(state.craft.x).toBeCloseTo(pose.x, 6);
    expect(state.craft.speed).toBe(0);
    expect(state.craft.airborne).toBe(false);
    // ...and the gate is then crossed by riding, not by the reset.
    expect(state.progress.nextGate).toBe(2);
    const events = ride(state, 4, () => FULL);
    expect(events.filter((e) => e.kind === "gate").length).toBe(0);
    expect(state.craft.x).toBeGreaterThan(g.x);
  });

  it("does nothing once the run is finished", () => {
    const state = createGame({ seed: 1, craft: "marlin", level: LEVEL, quiet: true });
    ride(state, 120, (s) => botInput(s));
    expect(state.phase).toBe("finished");
    const x = state.craft.x;
    step(state, { ...NEUTRAL_INPUT, reset: true });
    expect(state.events.some((e) => e.kind === "reset")).toBe(false);
    expect(Math.abs(state.craft.x - x)).toBeLessThan(1);
  });
});
