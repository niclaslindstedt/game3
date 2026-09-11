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
import {
  TUNING,
  biomeOf,
  createGame,
  placeRun,
  step,
  type CraftInput,
  type GameState,
  type Level,
} from "@engine";

import { skyAt } from "../pwa/src/game/sky.ts";
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
