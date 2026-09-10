// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The game orchestrator: `createGame` builds a run (a level, the sea on it,
// the wind over it, a craft at the start), `step` advances it exactly one
// fixed timestep and leaves the events that step emitted on the state. The
// app's render loop and the headless simulator drive this same function —
// there is no other way to advance a run.

import { createRng } from "../lib/prng.ts";
import { generateLevel, hourOfDay, type TimeOfDay } from "../mapgen/index.ts";
import type { Level, Weather, Wind } from "../mapgen/types.ts";
import { status } from "../output.ts";
import { stepCraft } from "./craft.ts";
import { freshProgress, resetCraft, standCraft, stepCourse } from "./course.ts";
import { craftById, type CraftId, type CraftSpec } from "./defs/craft.ts";
import { TUNING } from "./defs/tuning.ts";
import { identity } from "../lib/quat.ts";
import { NEUTRAL_INPUT, type CraftInput, type CraftState, type GameState } from "./state.ts";
import { createShelter } from "./fetch.ts";
import { createSea, seaSummary, type SeaOverride } from "./water.ts";
import { createWind, stepWind } from "./wind.ts";

export type CreateGameOptions = {
  seed: number;
  /** Which craft; defaults to the skiff. */
  craft?: CraftId;
  /** A level to ride instead of the one the seed generates (tests, labs). */
  level?: Level;
  /** A wind to ride in instead of the level's own. The sea is built from
   * it too, so a run staged in a gale has a gale's chop. */
  wind?: Wind;
  /** ...or only its SPEED, m/s, blowing from the level's own quarter. */
  windSpeed?: number;
  /** A sea quoted outright — a swell of this significant height, m, sent
   * in from beyond the fetch law — in place of the one the wind grows. */
  sea?: SeaOverride;
  /** The hour on the clock and the sky to ride the level under in place of
   * the ones it was dealt (R13, R19) — how a lab photographs a sunset on a
   * seed that came up at noon. The sea is the wind's and does not move. */
  hour?: number;
  weather?: Weather;
  /** ...or the hour named rather than counted: SUNRISE, DAY or SUNSET,
   * resolved against THIS coast's own daylight window (`hourOfDay`). An
   * explicit `hour` wins, being the more exact of the two. */
  timeOfDay?: TimeOfDay;
  /** Build without announcing the level (the sim's sweeps). */
  quiet?: boolean;
};

/** A craft at rest with nothing read yet; `standCraft` puts it somewhere. */
export function freshCraft(spec: CraftSpec): CraftState {
  return {
    spec,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    q: identity(),
    wx: 0,
    wy: 0,
    wz: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    rpm: spec.idleRpm,
    throttleEff: 0,
    nozzle: 0,
    trim: 0,
    bucket: 0,
    riderAft: 0,
    riderRight: 0,
    wetted: 0,
    airborne: false,
    airTime: 0,
    planing: 0,
    submergedDepth: 0,
    speed: 0,
    landing: 1e6,
    onRamp: false,
    onGround: false,
    hitCooldown: 0,
    groundCooldown: 0,
    launchVy: 0,
    dived: false,
    launchPending: false,
    capsizedFor: 0,
    righting: 0,
    pull: -1,
  };
}

export function createGame(options: CreateGameOptions): GameState {
  const spec = craftById(options.craft ?? "skiff");
  const dealt = options.level ?? generateLevel(options.seed);
  // A named time of day is resolved against the coast that was actually
  // dealt, which is why it is read here rather than by the caller: only the
  // level knows the latitude its daylight window is cut from (R13).
  const asked =
    options.hour ??
    (options.timeOfDay === undefined ? undefined : hourOfDay(dealt, options.timeOfDay));
  const level: Level =
    asked === undefined && options.weather === undefined
      ? dealt
      : {
          ...dealt,
          hour: asked === undefined ? dealt.hour : ((asked % 24) + 24) % 24,
          weather: options.weather ?? dealt.weather,
        };
  const wind =
    options.wind ??
    (options.windSpeed !== undefined
      ? { from: level.wind.from, speed: Math.max(0, options.windSpeed) }
      : level.wind);
  // What the coast does to that wind — the exposure the sea is dealt out
  // of and the shelter the rider feels — measured ONCE and handed to both
  // models, since they are two readings of the same coast.
  const shelter = createShelter(level, wind);
  const sea = createSea(level, options.seed, wind, options.sea, shelter);
  const state: GameState = {
    seed: options.seed,
    rng: createRng(options.seed),
    t: 0,
    tick: 0,
    level,
    sea,
    wind: createWind(level, wind, shelter),
    craft: freshCraft(spec),
    input: { ...NEUTRAL_INPUT },
    progress: freshProgress(level),
    phase: "running",
    events: [],
  };
  standCraft(state, level.start.x, level.start.z, level.start.heading);
  if (!options.quiet) {
    const summary = seaSummary(sea, level.start.x, level.start.z);
    status(
      `Level ${level.seed} (${level.biome}): ${level.course.gates.length} gates over ${Math.round(
        level.course.length,
      )} m, wind ${wind.speed.toFixed(1)} m/s, Hs ${summary.Hs.toFixed(2)} m at the start, ${spec.name}`,
    );
  }
  return state;
}

/** Advance the run by exactly one fixed step. */
export function step(state: GameState, input: CraftInput): GameState {
  const events = state.events;
  events.length = 0;
  state.t += TUNING.dt;
  state.tick += 1;
  state.input.steer = input.steer;
  state.input.throttle = input.throttle;
  state.input.lean = input.lean;
  state.input.reset = input.reset;

  // The wind gusts through every phase, and draws its randomness whether
  // or not anything feels it, so a finished run replays the same stream.
  stepWind(state.wind, state.rng, TUNING.dt);

  if (input.reset && state.phase === "running") {
    resetCraft(state, events);
    return state;
  }

  const c = state.craft;
  const x0 = c.x;
  const y0 = c.y;
  const z0 = c.z;
  stepCraft(state, state.phase === "running" ? input : NEUTRAL_INPUT, events);
  stepCourse(state, x0, y0, z0, events);
  return state;
}
