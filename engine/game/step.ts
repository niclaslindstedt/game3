// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The game orchestrator: `createGame` builds a run (a level, the sea on it,
// the wind over it, a craft at the start), `step` advances it exactly one
// fixed timestep and leaves the events that step emitted on the state. The
// app's render loop and the headless simulator drive this same function —
// there is no other way to advance a run.

import { clamp } from "../lib/math.ts";
import { createRng } from "../lib/prng.ts";
import { generateLevel, hourOfDay, type TimeOfDay } from "../mapgen/index.ts";
import type { BiomeId, Level, TrackKind, Weather, Wind } from "../mapgen/types.ts";
import type { Season } from "../lib/solar.ts";
import { status } from "../output.ts";
import { freshProgress, standCraft } from "./course.ts";
import { CRAFT_IDS, craftAtClass, craftById, type CraftId, type CraftSpec } from "./defs/craft.ts";
import {
  MODE_RULES,
  OPEN_RULES,
  TRICK_LIMITS,
  type GameMode,
  type RunRules,
} from "./defs/modes.ts";
import { TUNING } from "./defs/tuning.ts";
import { identity } from "../lib/quat.ts";
import { NEUTRAL_INPUT, type CraftInput, type CraftState, type GameState } from "./state.ts";
import { createShelter } from "./fetch.ts";
import { clipRiders, createRivals, stepRivals } from "./rivals.ts";
import { stepRun } from "./run.ts";
import { freshTricks } from "./tricks.ts";
import { createSea, seaSummary, type SeaOverride } from "./water.ts";
import { createWind, stepWind } from "./wind.ts";

export type CreateGameOptions = {
  seed: number;
  /** Which craft; defaults to the skiff. */
  craft?: CraftId;
  /** R32 — the SPEED CLASS, as the multiple of the catalog's own speed the
   * craft is ridden at; defaults to `TUNING.pump.speedClass`. It is TWO
   * things at once: the hull is derived at it (`craftAtClass`) and the
   * course is PACED for it, because gates are laid in metres and a faster
   * rider needs them further apart to be the same race. So the same seed at
   * two classes is two different courses. Ignored for the level when
   * `level` is given, which already carries its own pace. */
  speedClass?: number;
  /** R29 — which chapter of the rule book the seed is dealt from: a coast
   * sprint (the default) or an ocean circuit ridden in laps. Ignored when
   * `level` is given, which already is one or the other. */
  track?: TrackKind;
  /** WHICH COAST the seed is built on — a built biome (`BIOME_IDS`); the
   * taiga when nothing is asked. Ignored when `level` is given, which
   * already stands on one. */
  biome?: BiomeId;
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
  /** R36 — THE GROUNDSWELL the level is built with, m of significant
   * height inside `SWELL_DIAL`, in place of the one the seed deals. It is
   * the LEVEL's rather than the run's — the sea that came in off the open
   * ocean, which is why it is not the wind's — so it is ignored when
   * `level` is given, exactly as `biome` and `track` are, and a `sea`
   * quoted outright replaces the whole field including this band. */
  swell?: number;
  /** The hour on the clock the run starts at, the season and the sky to
   * ride the level under in place of the ones it was dealt (R13, R19) —
   * how a lab photographs a sunset on a seed that came up at noon, or a
   * winter night on one dealt in July. The sea is the wind's and does not
   * move, and neither does the water's temperature or what swims in it: a
   * season asked for here moves the SUN, not the level. */
  hour?: number;
  season?: Season;
  weather?: Weather;
  /** ...or the hour named rather than counted: SUNRISE, DAY or SUNSET,
   * resolved against THIS coast's own daylight window in the season being
   * ridden (`hourOfDay`). An explicit `hour` wins, being the more exact of
   * the two. */
  timeOfDay?: TimeOfDay;
  /** How much of the arcade's two hands to ride with, 0..1 each
   * (`GameState.assist` and `.rampAssist`, `TUNING.assist`); each hand's
   * own `strength` when left out. `assist` is the landing's and, left to
   * itself, the ramp's too — so `assist: 0` is the bare physics
   * everywhere, which is what a before-and-after is taken against —
   * while `rampAssist` moves the ramp's hand alone. */
  assist?: number;
  rampAssist?: number;
  /** ...and how late the AIR's hand arrives, s before the water; the
   * tuning's own `air.window` when nothing says. Strength and window
   * together are what a difficulty setting moves (`TUNING.assist.band` is
   * the ladder, and it carries the ramp's dial in the same rung). */
  assistWindow?: number;
  /** WHICH WAY ONTO THE WATER (`defs/modes.ts`): a race against a field, a
   * timed run for tricks, or the course against the clock alone. Left out,
   * the run is dealt the OPEN rules — every system on, nothing timed,
   * nobody else on the water — which is what the sim, the labs and the
   * tests ride. */
  mode?: GameMode;
  /** How long a TRICKS run lasts, s — one of `TRICK_LIMITS`; the shortest
   * when nothing says. Ignored by every other mode. */
  limit?: number;
  /** Any rule of the mode's, overridden by hand — a lab riding a race with
   * no lights, a test riding the open rules with a buzzer on them. */
  rules?: Partial<RunRules>;
  /** Build without announcing the level (the sim's sweeps). */
  quiet?: boolean;
};

/** The rules a run is dealt from what it asked for: the mode's, the
 * tricks run's own length laid over them, then any rule set by hand. */
export function rulesFor(options: Pick<CreateGameOptions, "mode" | "limit" | "rules">): RunRules {
  const base = options.mode === undefined ? OPEN_RULES : MODE_RULES[options.mode];
  const limit =
    options.mode === "tricks" && options.limit !== undefined
      ? (TRICK_LIMITS.find((l) => l === options.limit) ?? base.limit)
      : base.limit;
  return { ...base, limit, ...options.rules };
}

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
    crouch: 0,
    stand: 0,
    standHold: 0,
    wetted: 0,
    airborne: false,
    airTime: 0,
    planing: 0,
    submergedDepth: 0,
    submerged: 0,
    slam: 0,
    speed: 0,
    altitude: 0,
    way: 0,
    landing: 1e6,
    onRamp: false,
    onGround: false,
    hitCooldown: 0,
    groundCooldown: 0,
    tornadoCooldown: 0,
    bumpCooldown: 0,
    launchVy: 0,
    dived: false,
    launchPending: false,
    capsizedFor: 0,
    righting: 0,
    pumpCrossed: false,
    yank: 0,
    pumped: 0,
    whipCrossed: false,
    whipSide: 0,
    whip: 0,
    whipped: 0,
    tricking: false,
  };
}

export function createGame(options: CreateGameOptions): GameState {
  // R32 — the SPEED CLASS this run is ridden at, applied by deriving the
  // spec rather than read out of the tuning by the physics: it is a choice
  // a rider makes per run, and everything downstream reads one spec and
  // needs to know nothing about classes.
  const speedClass = options.speedClass ?? TUNING.pump.speedClass;
  const spec = craftAtClass(craftById(options.craft ?? "skiff"), speedClass);
  // ...and the course is PACED for it: gates are laid in metres, so the
  // class is part of what the level is (`mapgen/rules.ts`'s `rulesAtPace`).
  const dealt =
    options.level ??
    generateLevel(options.seed, {
      biome: options.biome,
      track: options.track,
      pace: speedClass,
      // R35 — a TRICKS run is ridden on a shore with a line of ramps down
      // it. The mode is what asks for them: the level is otherwise the very
      // one a race on this seed is ridden on.
      tricks: options.mode === "tricks",
      // R36 — the sea standing off the coast, when the run asked for one.
      swell: options.swell,
    });
  // A named time of day is resolved against the coast that was actually
  // dealt, which is why it is read here rather than by the caller: only the
  // level knows the latitude its daylight window is cut from (R13).
  const season = options.season ?? dealt.season;
  const asked =
    options.hour ??
    (options.timeOfDay === undefined
      ? undefined
      : hourOfDay({ biome: dealt.biome, season }, options.timeOfDay));
  const level: Level =
    asked === undefined && options.weather === undefined && season === dealt.season
      ? dealt
      : {
          ...dealt,
          season,
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
  const rules = rulesFor(options);
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
    tricks: freshTricks(),
    assist: clamp(options.assist ?? TUNING.assist.air.strength, 0, 1),
    rampAssist: clamp(options.rampAssist ?? options.assist ?? TUNING.assist.ramp.strength, 0, 1),
    assistWindow: Math.max(0, options.assistWindow ?? TUNING.assist.air.window),
    rules,
    rivals: [],
    countdown: rules.countdown,
    phase: rules.countdown > 0 ? "countdown" : "running",
    events: [],
  };
  standCraft(state, level.start.x, level.start.z, level.start.heading);
  // THE FIELD, on the roster at the player's own class, each hull the next
  // in the catalog after the last — so a race is against every kind of
  // craft the game has, and the grid deals itself from the run's stream
  // (`rivals.ts`). Nothing is drawn on a run with nobody else in it.
  if (rules.rivals > 0) {
    const crafts: CraftState[] = [];
    for (let i = 0; i < rules.rivals; i++) {
      const id = CRAFT_IDS[(CRAFT_IDS.indexOf(spec.id) + 1 + i) % CRAFT_IDS.length];
      crafts.push(freshCraft(craftAtClass(craftById(id), speedClass)));
    }
    createRivals(state, crafts);
  }
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

  // THE LIGHTS. The sea moves and the engines idle under them; nothing is
  // steered and no clock runs until they are out, and the step they go out
  // on is the first the rider is given the throttle.
  if (state.phase === "countdown") {
    const was = state.countdown;
    state.countdown = Math.max(0, was - TUNING.dt);
    // Each light as it begins: the first on the first step, the rest as
    // the count drops through a whole second.
    if (was === state.rules.countdown || Math.ceil(state.countdown) < Math.ceil(was)) {
      if (state.countdown > 0)
        events.push({ kind: "count", t: state.t, left: Math.ceil(state.countdown) });
    }
    if (state.countdown <= 0) {
      state.phase = "running";
      events.push({ kind: "go", t: state.t });
    }
  }

  // The player, then the field, each by the same step (`run.ts`); then
  // every hull against every other, once all of them have moved
  // (`rivals.ts`).
  stepRun(state, input, events);
  stepRivals(state);
  clipRiders(state, events);
  return state;
}
