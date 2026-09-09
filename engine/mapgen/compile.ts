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

import { createHeightfield, fieldGradient, sampleField } from "../lib/heightfield.ts";
import { valueNoise } from "../lib/noise.ts";
import type { Biome } from "./biomes.ts";
import { airCorridor, gateBuoys, type CoursePlan } from "./course.ts";
import type { Geology } from "./geology.ts";
import { LEVEL_RULES as R } from "./rules.ts";
import type { Shore } from "./shore.ts";
import type {
  Bounds,
  Level,
  Pod,
  Solid,
  Surface,
  Vec2,
  WaterBody,
  Weather,
  Wind,
} from "./types.ts";

export type LevelPlan = {
  readonly seed: number;
  readonly biome: Biome;
  readonly shore: Shore;
  readonly geology: Geology;
  readonly course: CoursePlan;
  readonly solids: readonly Solid[];
  readonly fauna: readonly Pod[];
  readonly wind: Wind;
  readonly water: WaterBody;
  readonly hour: number;
  readonly weather: Weather;
};

/** R14 — the box a course needs: everything it places, padded seaward
 * (east and south of a north-east coast) and landward, then snapped out
 * to the grid so the bounds are the grid's own edges. */
export function courseBounds(course: CoursePlan): Bounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  const take = (p: { x: number; z: number }): void => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  };
  for (const p of course.path) take(p);
  for (const g of course.gates) {
    take(g);
    for (const b of gateBuoys(g)) take(b);
    if (g.kind === "air") {
      const c = airCorridor(g);
      take({ x: c.x0, z: c.z0 });
      take({ x: c.x1, z: c.z1 });
    }
  }
  const cell = R.grid.cell;
  const snap = (v: number, up: boolean): number =>
    (up ? Math.ceil(v / cell) : Math.floor(v / cell)) * cell;
  return {
    minX: snap(minX - R.bounds.land, false),
    maxX: snap(maxX + R.bounds.sea, true),
    minZ: snap(minZ - R.bounds.sea, false),
    maxZ: snap(maxZ + R.bounds.land, true),
  };
}

export function insideBounds(bounds: Bounds, x: number, z: number): boolean {
  return x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;
}

export function compileLevel(plan: LevelPlan): Level {
  const bounds = courseBounds(plan.course);
  const cell = R.grid.cell;
  const cols = Math.round((bounds.maxX - bounds.minX) / cell) + 1;
  const rows = Math.round((bounds.maxZ - bounds.minZ) / cell) + 1;
  const ground = createHeightfield(bounds.minX, bounds.minZ, cell, cols, rows);
  const offshore = createHeightfield(bounds.minX, bounds.minZ, cell, cols, rows);
  // One shore lookup per cell feeds both grids: the lookup is the cost.
  for (let r = 0; r < rows; r++) {
    const z = bounds.minZ + r * cell;
    for (let c = 0; c < cols; c++) {
      const sample = plan.geology.sample(bounds.minX + c * cell, z);
      ground.data[r * cols + c] = sample.ground;
      offshore.data[r * cols + c] = sample.offshore;
    }
  }

  const { shore, biome } = plan;
  const boulderThreshold = 1 - (1 - R.surface.boulder.threshold) * biome.boulderField;
  // R16 — the classifier, in the rule's order.
  const materialAt = (x: number, z: number): Surface => {
    const h = sampleField(ground, x, z);
    if (h < 0) return "water";
    const { gx, gz } = fieldGradient(ground, x, z);
    const slope = Math.hypot(gx, gz);
    if (slope >= R.surface.bedrockSlope) return "bedrock";
    if (valueNoise(x, z, R.surface.boulder.scale, plan.geology.boulderSeed) >= boulderThreshold) {
      return "rock";
    }
    if (biome.sandPockets && slope < R.surface.sand.slope) {
      const inland = -sampleField(offshore, x, z);
      if (
        inland <= R.surface.sand.reach &&
        shore.bayAt(shore.toLocal(x, z).s) >= R.surface.sand.bay
      ) {
        return "sand";
      }
    }
    return "bedrock";
  };

  // The published shore is the stretch inside the level, with one vertex
  // past each edge so the line leaves the box rather than stopping in it.
  const shorePoints: Vec2[] = [];
  const pts = shore.points;
  for (let i = 0; i < pts.length; i++) {
    const here = insideBounds(bounds, pts[i].x, pts[i].z);
    const before = i > 0 && insideBounds(bounds, pts[i - 1].x, pts[i - 1].z);
    const after = i + 1 < pts.length && insideBounds(bounds, pts[i + 1].x, pts[i + 1].z);
    if (here || before || after) shorePoints.push({ x: pts[i].x, z: pts[i].z });
  }

  return {
    seed: plan.seed,
    biome: biome.id,
    bounds,
    ground,
    offshore,
    shore: shorePoints,
    materialAt,
    solids: plan.solids.map((s) => ({ ...s })),
    fauna: plan.fauna.map((f) => ({ ...f })),
    course: {
      gates: plan.course.gates.map((g) => (g.ramp ? { ...g, ramp: { ...g.ramp } } : { ...g })),
      path: plan.course.path.map((p) => ({ x: p.x, z: p.z })),
      length: plan.course.length,
    },
    start: { ...plan.course.start },
    wind: { ...plan.wind },
    water: { ...plan.water },
    hour: plan.hour,
    weather: plan.weather,
  };
}
