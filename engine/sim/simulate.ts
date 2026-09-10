// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The headless simulation harness: run the REAL engine — createGame, step,
// the bot rider — with no renderer attached, and report what happened.
// This is how handling and generator changes are measured (scripts/
// simulate-run.mjs renders the tables) and how the sim tests assert that a
// bot finishes what the generator builds. Runs are deterministic: the same
// seed, craft and level always produce the same digest.

import { TUNING } from "../game/defs/tuning.ts";
import type { CraftId } from "../game/defs/craft.ts";
import { createGame, step } from "../game/step.ts";
import type { GameEvent } from "../game/state.ts";
import { seaSummary } from "../game/water.ts";
import type { Level, Wind } from "../mapgen/types.ts";
import { botInput, RIDER_BOT, type BotProfile } from "./bot.ts";

export type SimOptions = {
  seed: number;
  craft?: CraftId;
  /** A level to ride instead of the seed's own. */
  level?: Level;
  wind?: Wind;
  profile?: BotProfile;
  /** Give up after this much simulated time, seconds. */
  maxSeconds?: number;
};

export type RunReport = {
  seed: number;
  craft: CraftId;
  finished: boolean;
  /** Run clock at the finish (or the timeout), s, penalties included. */
  time: number;
  gates: number;
  gatesPassed: number;
  gatesMissed: number;
  /** Course length, m. */
  courseLength: number;
  topSpeed: number;
  /** Seconds spent with nothing on the hull touching anything. */
  airTime: number;
  launches: number;
  dives: number;
  hits: number;
  groundings: number;
  resets: number;
  capsizes: number;
  /** The biggest significant wave height met, m, by the fetch at the
   * craft's position. */
  maxHs: number;
  events: GameEvent[];
  /** FNV-1a over sampled positions and speeds — the determinism fingerprint. */
  digest: string;
};

/**
 * How long a run is given before the harness gives up, s.
 *
 * MEASURED, and stated once so the CLI, the tests and a caller that names
 * nothing all give a run the same rope. A course-first level (R24) is 1.3
 * to 1.9 km of line with corners in it, ridden at 22 to 51 km/h depending
 * on the wind the seed drew — the slowest four-craft run over seeds 1 to 3
 * finishes at 316 s, and every one of the twelve finishes. The cap is here
 * to catch a rider who has STOPPED riding, not to assert a pace; the pace
 * has its own floor in `tests/simulation_test.ts`.
 */
export const SIM_SECONDS = 360;

/** Ride one level headlessly with the bot. */
export function simulateStage(options: SimOptions): RunReport {
  const craft = options.craft ?? "skiff";
  const profile = options.profile ?? RIDER_BOT;
  const maxSeconds = options.maxSeconds ?? SIM_SECONDS;
  const state = createGame({
    seed: options.seed,
    craft,
    level: options.level,
    wind: options.wind,
    quiet: true,
  });

  const events: GameEvent[] = [];
  let hash = 0x811c9dc5;
  const mix = (v: number): void => {
    hash ^= Math.round(v * 100) & 0xff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  };

  let topSpeed = 0;
  let airTime = 0;
  let launches = 0;
  let dives = 0;
  let hits = 0;
  let groundings = 0;
  let resets = 0;
  let capsizes = 0;
  let maxHs = 0;
  const maxSteps = Math.ceil(maxSeconds / TUNING.dt);
  let steps = 0;
  while (state.phase === "running" && steps < maxSteps) {
    const input = botInput(state, profile);
    step(state, input);
    const emitted = state.events;
    for (let i = 0; i < emitted.length; i++) {
      const e = emitted[i];
      events.push(e);
      if (e.kind === "launch") launches += 1;
      else if (e.kind === "dive") dives += 1;
      else if (e.kind === "hit") hits += 1;
      else if (e.kind === "ground") groundings += 1;
      else if (e.kind === "reset") resets += 1;
      else if (e.kind === "capsize") capsizes += 1;
    }
    const c = state.craft;
    if (c.speed > topSpeed) topSpeed = c.speed;
    if (c.airborne) airTime += TUNING.dt;
    steps += 1;
    if (steps % 30 === 0) {
      mix(c.x);
      mix(c.z);
      mix(c.speed);
      const hs = seaSummary(state.sea, c.x, c.z).Hs;
      if (hs > maxHs) maxHs = hs;
    }
  }
  mix(state.craft.x);
  mix(state.craft.y);
  mix(state.craft.z);

  const p = state.progress;
  return {
    seed: options.seed,
    craft,
    finished: state.phase === "finished",
    time: p.time,
    gates: state.level.course.gates.length,
    gatesPassed: p.passed.length,
    gatesMissed: p.missed.length,
    courseLength: state.level.course.length,
    topSpeed,
    airTime,
    launches,
    dives,
    hits,
    groundings,
    resets,
    capsizes,
    maxHs,
    events,
    digest: hash.toString(16).padStart(8, "0"),
  };
}
