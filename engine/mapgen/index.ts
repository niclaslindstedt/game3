// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The generator's public surface. `engine/index.ts` re-exports all of it;
// nothing outside `mapgen/` and `analysis/` reaches past this file.
export {
  LEVEL_RULES,
  inBand,
  solidBerth,
  solidRule,
  withinBand,
  type Band,
  type GenerateOptions,
  type LevelRules,
  type SolidRule,
} from "./rules.ts";
export { BIOMES, BIOME_IDS, biomeOf, type Biome } from "./biomes.ts";
export { layFauna, podClearance, walkPod, type PodLoop } from "./fauna.ts";
export { WEATHER_IDS, hasDeck, isWet, pickWeather, skyCover } from "./weather.ts";
export { TIMES_OF_DAY, hourOfDay, type TimeOfDay } from "./daytime.ts";
export { generateLevel, subSeed } from "./generate.ts";
export { compileLevel, courseBounds, insideBounds, type LevelPlan } from "./compile.ts";
export { drawRoute, type Route } from "./route.ts";
export { layBasin, pointOn, routeBounds, traceCoast, type Basin, type Island } from "./basin.ts";
export {
  bedDepth,
  createGeology,
  landHeight,
  laySolids,
  shelfFactor,
  type Geology,
  type KeepOut,
} from "./geology.ts";
export {
  airCorridor,
  arcHeight,
  courseKeepOut,
  cumulative,
  gateBuoys,
  layCourse,
  pointAlong,
  polylineDistance,
  rampSurface,
  ringPlacement,
  segmentDistance,
  walkPolyline,
  type CoursePlan,
} from "./course.ts";
export {
  analyzeLevel,
  ANALYSIS,
  type Finding,
  type LevelAnalysis,
  type Severity,
} from "../analysis/index.ts";
// The fields a level publishes are read through these; they are part of
// the level's contract, so they travel with it.
export {
  createHeightfield,
  fieldGradient,
  fillField,
  sampleField,
  type Heightfield,
} from "../lib/heightfield.ts";
export type {
  BiomeId,
  Bounds,
  Course,
  Gate,
  Level,
  Pod,
  Ramp,
  Solid,
  Surface,
  Vec2,
  WaterBody,
  Weather,
  Wind,
} from "./types.ts";
