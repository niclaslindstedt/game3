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

import { describe, expect, it } from "vitest";
import { TUNING, createGame, placeRun, step, type CraftInput } from "@engine";

import { takeSnapshot } from "../pwa/src/game/snapshot.ts";
import { syntheticLevel } from "./support/synthetic.ts";

const FLAT = syntheticLevel({ windSpeed: 0, noSolids: true });
const COAST: CraftInput = { steer: 0, throttle: 0, reverse: 0, lean: 0, reset: false };

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
