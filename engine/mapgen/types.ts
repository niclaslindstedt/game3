// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LEVEL, as the rest of the engine sees it. A level is a stretch of
// SHORE and the water beside it: the ground (sea bed and land, as a
// heightfield against sea level), the shoreline itself, the rocks standing
// in the water, the race course laid along the shore, and the conditions the
// run is ridden in. The generator (`generate.ts`) searches for one under the
// rules in `rules.ts`, the compiler (`compile.ts`) turns the winning plan into
// this shape ONCE, and nothing downstream — the craft, the collision engine,
// the renderer, the level map — ever regenerates any of it.
//
// COORDINATES: x east, z north, y up; sea level is y = 0. The heading
// convention is the engine's everywhere: 0 points along +z and grows
// CLOCKWISE seen from above (toward +x), so forward = (sin h, cos h) in the
// (x, z) plan. Metres, seconds, radians, kilograms.

import type { Heightfield } from "../lib/heightfield.ts";

/** The countries the shore can belong to. Only `taiga` is built; the rest are
 * the names the campaign will need, reserved so an id never changes. */
export type BiomeId = "taiga" | "archipelago" | "fjord" | "atoll" | "delta" | "arctic";

/** What the ground is made of where a point of shore stands. */
export type Surface = "bedrock" | "rock" | "sand" | "water";

/** A rock standing in (or just out of) the water: a vertical-axis solid the
 * craft can hit. `top` is the rock's height above sea level (negative for a
 * reef the hull can still touch), `r` its plan radius. */
export type Solid = {
  readonly id: string;
  readonly kind: "skerry" | "boulder" | "reef";
  readonly x: number;
  readonly z: number;
  readonly r: number;
  readonly top: number;
};

/** A floating ramp before an air gate: a flat plane the hull rides up,
 * hinged at the water at its rear edge and rising `angle` radians toward
 * its front edge. `heading` is the direction of travel up it. */
export type Ramp = {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly heading: number;
  readonly length: number;
  readonly width: number;
  readonly angle: number;
};

/** One checkpoint on the course, in course order. A WATER gate is a pair of
 * buoys `width` metres apart, centred at (x, z), facing `heading`; passing is
 * crossing the line between them in the facing direction. An AIR gate is a
 * ring of radius `width / 2` whose centre sits `y` metres above the sea, and
 * it always has the ramp that launches the craft through it. */
export type Gate = {
  readonly id: string;
  readonly index: number;
  readonly kind: "water" | "air";
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly heading: number;
  readonly width: number;
  readonly ramp?: Ramp;
};

export type Vec2 = { readonly x: number; readonly z: number };

/** The race path: the gates in order, the ideal line through them as a
 * polyline, and its length in metres. The last gate is the finish. */
export type Course = {
  readonly gates: readonly Gate[];
  readonly path: readonly Vec2[];
  readonly length: number;
};

/** The wind the level is ridden in: `from` is the compass heading it blows
 * FROM (engine heading convention), `speed` the mean at 10 m in m/s. */
export type Wind = {
  readonly from: number;
  readonly speed: number;
};

/** The water itself. Density is kg/m³ (fresh 1000, brackish ~1005, sea
 * ~1025 — the Baltic taiga coast is brackish); temperature °C is what the
 * fauna and the spray will read later. */
export type WaterBody = {
  readonly density: number;
  readonly temperature: number;
};

export type Bounds = {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
};

export type Level = {
  readonly seed: number;
  readonly biome: BiomeId;
  readonly bounds: Bounds;
  /** Ground height against sea level: the sea bed under the water, the land
   * above it. Land is only meaningful within ~100 m of the shore. */
  readonly ground: Heightfield;
  /** Metres from the nearest shoreline, positive out to sea, negative
   * inland. The wave model reads it as FETCH; the course rules bound it. */
  readonly offshore: Heightfield;
  /** The main coast as a polyline, south-west to north-east in course order. */
  readonly shore: readonly Vec2[];
  /** What the shore is made of at a plan point. */
  readonly surfaceAt: (x: number, z: number) => Surface;
  readonly solids: readonly Solid[];
  readonly course: Course;
  /** Where the run starts: behind the first gate, pointing at it. */
  readonly start: { readonly x: number; readonly z: number; readonly heading: number };
  readonly wind: Wind;
  readonly water: WaterBody;
  /** Hour of day, 0..24. Read by nobody yet; the sky will. */
  readonly hour: number;
};
