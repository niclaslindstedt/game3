// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE COURSE'S MARKS, held without a GPU. What a gate mark LOOKS like is
// judged by looking (`make screenshots SCENE=gate`, under two skies); what
// is asserted here is the three rules that decide what its lantern is
// doing and which lanterns the water carries — the first because "the lamp
// goes out when the gate is behind you" is the whole reading a rider takes
// off a night course, the second because the red on a checkpoint left
// behind and the HUD's own warning must go out on the same step or the two
// disagree about how close to it a rider has to get, and the third because
// the sea has four slots and a level puts forty lamps on it.
import { describe, expect, it } from "vitest";

import { nearestLamps, type BuoyLamp } from "../pwa/src/game/buoys.ts";
import { markLamp, missedLamp } from "../pwa/src/game/gates.ts";
import { BUOY_LAMPS } from "../pwa/src/game/water-shader.ts";

/** A few seconds spread over the next gate's breath, so nothing here reads
 * one instant of a lamp that moves. */
const MOMENTS = [0, 0.4, 0.9, 1.5, 2.3, 3.7];

function lamp(x: number, z: number, lit: number): BuoyLamp {
  return { x, y: 1.7, z, lit };
}

describe("a gate mark's lantern", () => {
  it("goes out the moment its gate is behind the rider", () => {
    for (const t of MOMENTS) {
      for (const night of [0, 0.5, 1]) {
        expect(markLamp(3, 4, night, t)).toBe(0);
        expect(markLamp(0, 12, night, t)).toBe(0);
      }
    }
  });

  it("burns on the gate being ridden at and on no other", () => {
    // The whole reading: ONE pair of lamps on the water at a time, so the
    // lit mark is a target rather than a map of where the course goes.
    for (const t of MOMENTS) {
      expect(markLamp(4, 4, 1, t)).toBeGreaterThan(0);
      expect(markLamp(4, 4, 1, t)).toBeLessThanOrEqual(1);
      for (const gate of [5, 7, 9, 20]) expect(markLamp(gate, 4, 1, t)).toBe(0);
    }
  });

  it("hands over the instant the gate before it is crossed", () => {
    // Gate 5 is dark while 4 is being ridden at and lit the moment the run
    // moves on to it — which is the moment 4's line was crossed.
    expect(markLamp(5, 4, 1, 1.3)).toBe(0);
    expect(markLamp(5, 5, 1, 1.3)).toBeGreaterThan(0);
    expect(markLamp(4, 5, 1, 1.3)).toBe(0);
  });

  it("breathes on the gate being ridden at", () => {
    const next = MOMENTS.map((t) => markLamp(4, 4, 1, t));
    expect(Math.max(...next) - Math.min(...next)).toBeGreaterThan(0.05);
  });

  it("is a wink of glass by day and a beacon after dark", () => {
    for (const t of MOMENTS) {
      const day = markLamp(4, 4, 0, t);
      const dark = markLamp(4, 4, 1, t);
      expect(day).toBeGreaterThan(0);
      expect(dark).toBeGreaterThan(day * 2);
      expect(dark).toBeLessThanOrEqual(1);
    }
  });

  it("leaves a finished course dark", () => {
    // The run is past the last gate, so every gate of the lap is behind.
    for (let gate = 0; gate < 12; gate++) expect(markLamp(gate, 12, 1, 1.3)).toBe(0);
  });
});

describe("a missed checkpoint's marks", () => {
  it("beat on the checkpoint the warning stands on and on no other", () => {
    for (const t of MOMENTS) {
      expect(missedLamp(4, 4, 1, t)).toBeGreaterThan(0);
      expect(missedLamp(4, 4, 1, t)).toBeLessThanOrEqual(1);
      for (const gate of [0, 3, 5, 9]) expect(missedLamp(gate, 4, 1, t)).toBe(0);
    }
  });

  it("goes dark on every mark once the warning has cleared", () => {
    // −1 is `activeMissedGate` back to null — the step the rider rode back
    // inside the checkpoint's opening. The red and the HUD's type are the
    // same number, so they cannot disagree about how close that is.
    for (const t of MOMENTS) {
      for (const night of [0, 0.5, 1]) {
        for (let gate = 0; gate < 12; gate++) expect(missedLamp(gate, -1, night, t)).toBe(0);
      }
    }
  });

  it("does not take the lamp off the gate the run owes", () => {
    // A miss advances the run, so the amber target moves on while the red
    // warning stands on the gate behind: two readings, two gates, one step.
    expect(markLamp(5, 5, 1, 1.3)).toBeGreaterThan(0);
    expect(missedLamp(5, 4, 1, 1.3)).toBe(0);
    expect(missedLamp(4, 4, 1, 1.3)).toBeGreaterThan(0);
    expect(markLamp(4, 5, 1, 1.3)).toBe(0);
  });

  it("is louder than a target lamp, by day and by its beat", () => {
    const warn = MOMENTS.map((t) => missedLamp(4, 4, 1, t));
    const next = MOMENTS.map((t) => markLamp(4, 4, 1, t));
    expect(Math.max(...warn) - Math.min(...warn)).toBeGreaterThan(
      Math.max(...next) - Math.min(...next),
    );
    // A rider is told they left a checkpoint behind at noon as often as at
    // midnight, so daylight takes far less of this one than of a lantern.
    expect(missedLamp(4, 4, 0, 1.3)).toBeGreaterThan(markLamp(4, 4, 0, 1.3) * 2);
  });
});

describe("the lamps the water carries", () => {
  it("takes the nearest, in order, and never more than the sea has slots for", () => {
    const gates = [lamp(10, 0, 1), lamp(40, 0, 1), lamp(90, 0, 1), lamp(5, 0, 1), lamp(70, 0, 1)];
    const picked = nearestLamps(gates, [], 0, 0);
    expect(picked.length).toBe(BUOY_LAMPS);
    expect(picked.map((l) => l.x)).toEqual([5, 10, 40, 70]);
  });

  it("picks across both lists by range rather than by which list they came from", () => {
    const gates = [lamp(0, 60, 1), lamp(0, 80, 1)];
    const marks = [lamp(0, 12, 1), lamp(0, 30, 1)];
    expect(nearestLamps(gates, marks, 0, 0).map((l) => l.z)).toEqual([12, 30, 60, 80]);
  });

  it("drops a lamp that is dark this frame rather than spending a slot on it", () => {
    const gates = [lamp(1, 0, 0), lamp(2, 0, 0), lamp(3, 0, 0), lamp(99, 0, 0.4)];
    const picked = nearestLamps(gates, [], 0, 0);
    expect(picked.length).toBe(1);
    expect(picked[0].x).toBe(99);
  });

  it("hands back nothing when no mark on the level is lit", () => {
    expect(nearestLamps([lamp(1, 0, 0)], [lamp(2, 0, 0)], 0, 0).length).toBe(0);
  });
});
