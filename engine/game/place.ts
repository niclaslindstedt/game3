// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// PLACING A RUN AT A MOMENT instead of riding to it. A landing only exists
// once a ramp has been taken, a dive only once a landing has gone wrong,
// and a screenshot of either used to cost the whole ride. This module
// stands the craft where the ride would have left it: at a plan point, on
// a heading, at a speed — afloat at its rest draft, or in the air at a
// height with an attitude and a climb — with the clock and the progress
// reading as though it had ridden there. The scenarios (`pwa/src/game/
// scenarios.ts`), the ride lab and the flight tests all stage through it.
//
// THE MOMENT ITSELF IS STILL THE ENGINE'S TO EMIT: a placed flight lands
// on the next steps and fires `land` the way every landing fires. Nothing
// random is drawn, so a placed moment reproduces from its description
// exactly as a ridden one reproduces from its seed.

import { fromEuler } from "../lib/quat.ts";
import { clamp } from "../lib/math.ts";
import { standCraft } from "./course.ts";
import { restY } from "./hull.ts";
import { TUNING } from "./defs/tuning.ts";
import { maxRpm } from "./limits.ts";
import type { GameState } from "./state.ts";
import { heightAt } from "./water.ts";

export type RunMoment = {
  /** Where, in the plan, m. */
  x: number;
  z: number;
  /** Heading, rad (0 = +z, clockwise from above). */
  heading: number;
  /** Speed along the heading, m/s; at rest when left out. */
  speed?: number;
  /** Height of the centre of gravity above the still surface, m. Left out
   * (or 0), the craft is afloat at its rest draft; given, it is in the
   * air, with `vy` m/s of climb. */
  height?: number;
  vy?: number;
  /** ...and how long it has ALREADY been up, s, when the moment staged is
   * part-way through a flight rather than the instant one began. It is the
   * air clock's own line that makes this worth saying (`flight.airCounts`):
   * a hull stood at the top of its arc has been in the air for about a
   * second, and one stood with the clock at zero photographs as a hop.
   * Left out, the flight starts where it is stood. Ignored with no
   * `height`. */
  airTime?: number;
  /** Attitude, rad: nose up positive, right side down positive. */
  pitch?: number;
  roll?: number;
  /** Pitch rate to put it down with, rad/s, nose-up positive — a flip
   * already begun — and a roll rate, rad/s, right side down positive — a
   * hull already going over. */
  pitchRate?: number;
  rollRate?: number;
  /** The run clock to stand it at, s, and which gate is next. */
  time?: number;
  nextGate?: number;
  /** The WORLD's clock to stand the moment at, s — `state.t`, which the
   * sea, the wind and the sea life are all functions of. Left out, the
   * world stays where it was; given, the moment is staged at a chosen
   * instant of the level's own day, which is the only way to photograph
   * something that happens on its own schedule rather than the rider's (an
   * animal at the top of a breach). Not `time`: that one is the RUN's
   * clock, the number on the HUD. */
  clock?: number;
};

/** Stand the run at a moment. */
export function placeRun(state: GameState, moment: RunMoment): void {
  // Before anything reads the sea: every height below is taken at the
  // world's clock, so moving it is the first thing done, not the last.
  if (moment.clock !== undefined) state.t = moment.clock;
  const c = state.craft;
  standCraft(state, moment.x, moment.z, moment.heading);
  const speed = moment.speed ?? 0;
  const pitch = moment.pitch ?? 0;
  const roll = moment.roll ?? 0;
  c.q = fromEuler(moment.heading, pitch, roll);
  c.heading = moment.heading;
  c.pitch = pitch;
  c.roll = roll;
  c.vx = Math.sin(moment.heading) * speed;
  c.vz = Math.cos(moment.heading) * speed;
  c.vy = moment.vy ?? 0;
  // Body rates are right-handed: nose-up is −wx and right-side-down is −wz
  // (`quat.ts` owns the flip).
  c.wx = -(moment.pitchRate ?? 0);
  c.wz = -(moment.rollRate ?? 0);
  const height = moment.height ?? 0;
  if (height > 0) {
    c.y = heightAt(state.sea, state.level, moment.x, moment.z, state.t) + height;
    c.airborne = true;
    c.airTime = Math.max(moment.airTime ?? 0, 0.01);
    c.launchVy = c.vy;
  } else {
    // A hull under way rides higher than one at rest.
    const rise = TUNING.hull.planingRise * clamp(speed / 12, 0, 1);
    c.y =
      heightAt(state.sea, state.level, moment.x, moment.z, state.t) +
      restY(c.spec, state.level.water.density) +
      rise;
  }
  // An engine that has been pulling: revs roughly where the speed puts
  // them, the throttle open, so the next step neither stalls nor lurches.
  const share = clamp((speed * 3.6) / c.spec.topSpeed, 0, 1);
  c.rpm = c.spec.idleRpm + (maxRpm(c.spec) - c.spec.idleRpm) * share;
  c.throttleEff = speed > 1 ? 1 : 0;
  c.planing = speed > 8 ? 1 : 0;
  c.speed = Math.hypot(c.vx, c.vy, c.vz);
  if (moment.time !== undefined) state.progress.time = moment.time;
  if (moment.nextGate !== undefined) {
    state.progress.nextGate = clamp(moment.nextGate, 0, state.level.course.gates.length);
  }
}
