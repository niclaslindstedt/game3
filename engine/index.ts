// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Public entry point for the game engine. The engine is framework-free and
// renderer-free: the browser app under `pwa/` consumes this module via the
// `@engine` alias, drives `step()` from its render loop at a fixed timestep,
// and reads the returned state to draw. The headless simulator and the
// tests consume the very same surface. See docs/architecture.md.

export { engineVersion } from "./version.ts";
export {
  status,
  info,
  warn,
  error,
  header,
  debug,
  setOutputSink,
  setDebugEnabled,
  recentLogs,
  type OutputLevel,
  type OutputSink,
} from "./output.ts";

// The simulation.
export { createGame, freshCraft, step, type CreateGameOptions } from "./game/step.ts";
// A run stood at a moment instead of ridden to it (place.ts).
export { placeRun, type RunMoment } from "./game/place.ts";
export {
  NEUTRAL_INPUT,
  type CraftInput,
  type CraftState,
  type GameEvent,
  type GamePhase,
  type GameState,
  type Progress,
} from "./game/state.ts";
export {
  CRAFT,
  CRAFT_IDS,
  craftById,
  isCraftId,
  type CraftId,
  type CraftSpec,
} from "./game/defs/craft.ts";
export { TUNING } from "./game/defs/tuning.ts";
export {
  FAUNA,
  FAUNA_IDS,
  faunaById,
  isFaunaId,
  rarityOf,
  type FaunaId,
  type FaunaKind,
  type FaunaSpec,
  type Rarity,
} from "./game/defs/fauna.ts";
// THE SEA LIFE, MOVING (game/fauna.ts): where one animal of a pod is at a
// moment — the fauna's own `surfaceAt`, a pure function of the pod and the
// clock, which is the only thing the renderer needs to draw a whale.
export { POD_LAYER, faunaCount, faunaPose, freshPose, type FaunaPose } from "./game/fauna.ts";
export { freshDamage, type CraftDamage } from "./game/damage.ts";
export { NO_TRICKS, type TrickScore } from "./game/tricks.ts";

// THE SEA (water.ts): the field, the surface at a point, and the numbers
// that describe it.
export {
  createSea,
  effectiveFetch,
  fetchGrowth,
  fetchHeight,
  fetchPeriod,
  heightAt,
  periodForHeight,
  seaSummary,
  shoaling,
  surfaceAt,
  wavenumber,
  type SeaOverride,
  type SeaState,
  type SurfaceSample,
  type WaveComponent,
} from "./game/water.ts";
// THE WIND (wind.ts).
export { createWind, stepWind, windAt, windSpeedAt, type WindState } from "./game/wind.ts";
// THE HULL (hull.ts): the probes and the rest draft.
export {
  frictionCoefficient,
  hullProbes,
  inertia,
  restY,
  totalMass,
  type HullProbe,
  type HullResult,
} from "./game/hull.ts";
// THE PLANING SURFACE (hydro.ts).
export { planingLift, pressureCentre, wettedLength, type PlaningResult } from "./game/hydro.ts";
// THE PUMP (propulsion.ts).
export {
  curveTorque,
  engineTorque,
  jetVelocity,
  nozzleArea,
  peakTorque,
  pumpTorque,
  staticThrust,
  thrust,
} from "./game/propulsion.ts";
// What a craft CAN do, stated once (limits.ts).
export {
  MAX_LEAN,
  airPitchTorque,
  jetCeiling,
  maxNozzle,
  maxRpm,
  topSpeedOf,
} from "./game/limits.ts";
// Contacts (collision.ts) and the course (course.ts).
export { boundsPush, onRampDeck, rampDeckY, solidNear } from "./game/collision.ts";
export { bearingToNext, crossedGate, gatesReached, resetPose } from "./game/course.ts";

// The level generator and its analyzer.
export * from "./mapgen/index.ts";

// The headless simulator and its bot rider.
export { simulateStage, type RunReport, type SimOptions } from "./sim/simulate.ts";
export { botInput, launchSpeedFor, RIDER_BOT, type BotProfile } from "./sim/bot.ts";
export { type RunTape, type TapeSample } from "./sim/tape.ts";

// Deterministic utilities shared with tooling.
export { createRng, type Rng } from "./lib/prng.ts";
export { hash2, smooth, valueNoise } from "./lib/noise.ts";
export { angleDiff, clamp, lerp, TAU } from "./lib/math.ts";
export {
  fromEuler,
  identity,
  integrate,
  multiply,
  normalize,
  rotate,
  toEuler,
  unrotate,
  type Quat,
  type Vec3,
} from "./lib/quat.ts";
