// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE HUD READS, taken off the state about twelve times a second. The
// canvas is the sixty-frame surface; the HUD is not, and a readout that
// re-rendered every frame would spend more on the DOM than on the sea. So
// the loop takes THIS every ~80 ms and the HUD draws from it. DOM-free —
// a snapshot is numbers, and the same numbers a lab could print.
//
// Nothing in here decides anything: the speed is the engine's `speed`, the
// rev fraction is against the engine's own redline, the gate count is the
// progress the engine keeps. A number that decided an outcome would be a
// rule in the shell (§23.2), and there are none.

import { maxRpm, windAt, type CraftId, type GameState } from "@engine";

import { SCREEN_TO_ENGINE } from "./input-model.ts";

export type HudSnapshot = {
  speedKmh: number;
  /** Revs as a share of the redline, 0..1, and where idle sits on the
   * same scale — the bar starts there. */
  rpm: number;
  idle: number;
  /** The run clock, s, and whether it has stopped. */
  time: number;
  finished: boolean;
  /** Gates passed (missed ones count as reached) and gates in the course. */
  passed: number;
  gates: number;
  /** The wind at the craft: the SCREEN angle its arrow points along, rad
   * clockwise from straight up (the direction it blows TO, relative to the
   * craft's nose), and its speed, m/s. */
  windAngle: number;
  windMs: number;
  airborne: boolean;
  airTime: number;
  seed: number;
  craft: CraftId;
};

export function takeSnapshot(state: GameState): HudSnapshot {
  const c = state.craft;
  const p = state.progress;
  const wind = windAt(state.wind, Math.max(0, c.y));
  const blowsTo = Math.atan2(wind.vx, wind.vz);
  return {
    speedKmh: c.speed * 3.6,
    rpm: c.rpm / maxRpm(c.spec),
    idle: c.spec.idleRpm / maxRpm(c.spec),
    time: p.time,
    finished: p.finished,
    passed: p.passed.length + p.missed.length,
    gates: state.level.course.gates.length,
    // Relative to the nose, then onto the screen: the engine's clockwise
    // is the screen's counter-clockwise (input-model.ts).
    windAngle: (blowsTo - c.heading) * SCREEN_TO_ENGINE,
    windMs: Math.hypot(wind.vx, wind.vz),
    airborne: c.airborne,
    airTime: c.airTime,
    seed: state.seed,
    craft: c.spec.id,
  };
}
