// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE COURSE'S MARKS, held without a GPU. What a gate mark LOOKS like is
// judged by looking (`make screenshots SCENE=gate`, under two skies); what
// is asserted here is the three rules that decide what its lantern is
// doing and which lanterns the water carries — the first because "one lamp
// at a time, and only after dark" is the whole reading a rider takes off a
// night course, the second because the red on a checkpoint left behind and
// the HUD's own warning must go out on the same step or the two disagree
// about how close to it a rider has to get, and the third because the sea
// has four slots and a level puts forty lamps on it.
import { describe, expect, it } from "vitest";

import type { Gate } from "@engine";

import { buoyLamp, markOf, nearestLamps, type BuoyLamp } from "../pwa/src/game/buoys.ts";
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

  it("is out in daylight and a beacon after dark", () => {
    // A lantern exists so a mark can be found when it cannot be seen. By
    // day it can be, and the course is read off the paint instead — so the
    // lamp is the sky's own switch and nothing of its own.
    for (const t of MOMENTS) {
      expect(markLamp(4, 4, 0, t)).toBe(0);
      const dusk = markLamp(4, 4, 0.5, t);
      const dark = markLamp(4, 4, 1, t);
      expect(dusk).toBeGreaterThan(0);
      expect(dark).toBeGreaterThan(dusk);
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

  it("is louder than a target lamp, and survives the daylight that puts one out", () => {
    const warn = MOMENTS.map((t) => missedLamp(4, 4, 1, t));
    const next = MOMENTS.map((t) => markLamp(4, 4, 1, t));
    expect(Math.max(...warn) - Math.min(...warn)).toBeGreaterThan(
      Math.max(...next) - Math.min(...next),
    );
    // A rider is told they left a checkpoint behind at noon as often as at
    // midnight. The lantern is the dark's alone; this is not a lantern, it
    // is the HUD's warning drawn on the water, so it is there at noon.
    const day = MOMENTS.map((t) => missedLamp(4, 4, 0, t));
    for (const t of MOMENTS) expect(markLamp(4, 4, 0, t)).toBe(0);
    for (const worth of day) expect(worth).toBeGreaterThan(0);
    expect(Math.max(...day)).toBeGreaterThan(0.5);
  });
});

describe("a rounding buoy's lantern", () => {
  /** A lap: a water gate, then the two cans B1 and B2, then a water gate —
   * the shape `course.ts` publishes for a circuit, where a slalom gate's
   * `mark` names the solid standing in its water. */
  const LAP: Gate[] = [
    { id: "G1", index: 0, kind: "water", x: 0, y: 0, z: 0, heading: 0, width: 12 },
    { id: "G2", index: 1, kind: "slalom", x: 0, y: 0, z: 0, heading: 0, width: 40, mark: "B1" },
    { id: "G3", index: 2, kind: "slalom", x: 0, y: 0, z: 0, heading: 0, width: 40, mark: "B2" },
    { id: "G4", index: 3, kind: "water", x: 0, y: 0, z: 0, heading: 0, width: 12 },
  ];

  it("names the can a checkpoint stands on, and nothing for one that has none", () => {
    expect(markOf(LAP, 1)).toBe("B1");
    expect(markOf(LAP, 2)).toBe("B2");
    expect(markOf(LAP, 0)).toBeUndefined();
    expect(markOf(LAP, null)).toBeUndefined();
    // Past the last gate: a finished course names no can, so nothing burns.
    expect(markOf(LAP, LAP.length)).toBeUndefined();
  });

  it("burns on the corner being ridden at and on no other", () => {
    for (const flash of [0, 0.5, 1]) {
      expect(buoyLamp(true, flash, 1)).toBeGreaterThan(0);
      expect(buoyLamp(false, flash, 1)).toBe(0);
    }
  });

  it("is out in daylight, whosever corner it is", () => {
    for (const flash of [0, 0.5, 1]) {
      expect(buoyLamp(true, flash, 0)).toBe(0);
      expect(buoyLamp(false, flash, 0)).toBe(0);
    }
  });

  it("holds a standing glow between the flashes rather than going out", () => {
    // A character is mostly darkness, and a corner that is not there nine
    // frames in ten is a corner met at speed in the dark.
    const between = buoyLamp(true, 0, 1);
    expect(between).toBeGreaterThan(0);
    expect(buoyLamp(true, 1, 1)).toBeGreaterThan(between * 2);
    expect(buoyLamp(true, 1, 1)).toBeLessThanOrEqual(1);
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
