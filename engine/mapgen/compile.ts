// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R14, R16 — THE COMPILER: the winning plan turned into a `Level`, ONCE.
// The search worked on analytic functions — the shore's distance, the
// geology's ground — because it had to ask about points before it knew
// where the level would be. Now that the course says where, the two
// heightfields are baked over its extent, the surface classifier is closed
// over them, and everything downstream reads grids: a buoyancy probe at
// 120 Hz is two lerps, not a noise stack (OSS_GAME_SPEC §24.5).
//
// The level is read-only from here on. Nothing regenerates any of it.

import {
  createHeightfield,
  fieldGradient,
  sampleField,
  type Heightfield,
} from "../lib/heightfield.ts";
import { lerp } from "../lib/math.ts";
import type { Season } from "../lib/solar.ts";
import { valueNoise } from "../lib/noise.ts";
import type { Biome } from "./biomes.ts";
import { traceCoast } from "./basin.ts";
import { type CoursePlan } from "./course.ts";
import type { Geology } from "./geology.ts";
import { LEVEL_RULES as R } from "./rules.ts";
import type { River } from "./river.ts";
import { layFlow } from "./flow.ts";
import type {
  Bounds,
  Level,
  Pod,
  Solid,
  Surface,
  TrackKind,
  WaterBody,
  Weather,
  Wind,
} from "./types.ts";

export type LevelPlan = {
  readonly seed: number;
  readonly biome: Biome;
  readonly track: TrackKind;
  /** R32 — the speed class the course was paced for. */
  readonly pace: number;
  readonly bounds: Bounds;
  /** The two grids, already baked (`layBasin`, `bakeGround`). */
  readonly offshore: Heightfield;
  readonly ground: Heightfield;
  readonly geology: Geology;
  readonly course: CoursePlan;
  readonly river: River;
  readonly solids: readonly Solid[];
  readonly fauna: readonly Pod[];
  readonly wind: Wind;
  readonly water: WaterBody;
  readonly season: Season;
  readonly hour: number;
  readonly weather: Weather;
};

export function insideBounds(bounds: Bounds, x: number, z: number): boolean {
  return x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;
}

/** The GROUND, baked over the offshore field the basin already laid. Two
 * grids on the same cells, and the second is read from the first: how far
 * a point is from the water's edge is the only thing the ground's profile
 * asks about. */
export function bakeGround(offshore: Heightfield, geology: Geology): Heightfield {
  const { originX, originZ, cell, cols, rows } = offshore;
  const ground = createHeightfield(originX, originZ, cell, cols, rows);
  for (let r = 0; r < rows; r++) {
    const z = originZ + r * cell;
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      ground.data[i] = geology.groundAt(originX + c * cell, z, offshore.data[i]);
    }
  }
  return ground;
}

export function compileLevel(plan: LevelPlan): Level {
  const { bounds, offshore, ground, biome, geology } = plan;
  const { boulder, sand } = R.surface;
  // R16, R21 — the classifier, in the rule's order. Everything but the
  // slope is a question about the STRETCH of coast a point belongs to, so
  // the one thing it works out first is which stretch that is.
  const materialAt = (x: number, z: number): Surface => {
    const h = sampleField(ground, x, z);
    if (h < 0) return "water";
    const { gx, gz } = fieldGradient(ground, x, z);
    const slope = Math.hypot(gx, gz);
    if (slope >= R.surface.bedrockSlope) return "bedrock";
    const rugged = geology.ruggedAt(x, z);
    // THE BEACH, before the boulder field rather than after it: a beach is
    // a CONTINUOUS run of sand at the waterline, and a field allowed to
    // speckle it is a beach nobody would walk on. It reaches furthest up
    // the softest stretches and narrows away rather than ending at a line,
    // so a coast does not step from sand to slab in one cell.
    if (biome.beaches && rugged <= sand.rugged && slope < sand.slope) {
      const soft = 1 - rugged / sand.rugged;
      const inland = -sampleField(offshore, x, z);
      if (inland <= sand.reach * (sand.floor + (1 - sand.floor) * soft)) return "sand";
    }
    // The field thickens with the coast: a moraine headland is mostly
    // boulder, the ground behind a beach carries none.
    const spread = biome.boulderField * lerp(boulder.rugged.low, boulder.rugged.high, rugged);
    const threshold = Math.max(0, 1 - (1 - boulder.threshold) * spread);
    if (valueNoise(x, z, boulder.scale, plan.geology.boulderSeed) >= threshold) return "rock";
    return "bedrock";
  };

  // The published coastlines: the water's edge traced out of the field it
  // was baked into. There is more than one — the mainland, and one round
  // every island the basin cut — which is the whole difference between a
  // coast that is a function of a base line and a coast that is a place.
  const shore = traceCoast(offshore);

  return {
    seed: plan.seed,
    biome: biome.id,
    track: plan.track,
    pace: plan.pace,
    bounds,
    ground,
    offshore,
    shore,
    materialAt,
    solids: plan.solids.map((s) => ({ ...s })),
    river: plan.river.points.map((p) => ({ x: p.x, z: p.z })),
    flow: layFlow(plan.river, ground),
    fauna: plan.fauna.map((f) => ({ ...f })),
    course: {
      gates: plan.course.gates.map((g) => (g.ramp ? { ...g, ramp: { ...g.ramp } } : { ...g })),
      path: plan.course.path.map((p) => ({ x: p.x, z: p.z })),
      length: plan.course.length,
      laps: plan.course.laps,
      lapGates: plan.course.lapGates,
    },
    start: { ...plan.course.start },
    wind: { ...plan.wind },
    water: { ...plan.water },
    season: plan.season,
    hour: plan.hour,
    weather: plan.weather,
  };
}
