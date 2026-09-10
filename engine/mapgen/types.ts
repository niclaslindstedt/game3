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

import type { FaunaId } from "../game/defs/fauna.ts";
import type { Heightfield } from "../lib/heightfield.ts";

/** The countries the shore can belong to. Only `taiga` is built; the rest are
 * the names the campaign will need, reserved so an id never changes. */
export type BiomeId = "taiga" | "archipelago" | "fjord" | "atoll" | "delta" | "arctic";

/** What the ground is made of where a point of shore stands. */
export type Surface = "bedrock" | "rock" | "sand" | "water";

/** THE SKY a level is ridden under (R19). Five, and they are five different
 * skies rather than one sky at five densities: the first two are OPEN — a
 * gradient with cloud floating in it — and the last three have a LID, a
 * ceiling whose underside is most of what the rider can see overhead.
 *
 *   clear     open blue, a handful of fair-weather cumulus.
 *   high      open, with a high sheet across it: the light softened, the
 *             blue paler, the sun still a disc.
 *   overcast  a dry stratus lid, flat and high, the light shadowless.
 *   rain      a lower, whiter, ragged ceiling — a wet day is a WHITE sky,
 *             brighter overhead than anything on the water — and the view
 *             closes right in.
 *   squall    a black gust front kilometres thick, its one bright thing the
 *             strip at the rim where daylight still gets in under the base.
 *
 * The word is drawn per seed from the biome's own chart; how HEAVY that sky
 * is comes from the level's wind (`weather.ts`). */
export type Weather = "clear" | "high" | "overcast" | "rain" | "squall";

/** A rock standing in the water or on the shore beside it: a vertical-axis
 * solid the craft can hit. `top` is the rock's height above SEA level
 * (negative for a reef the hull can still touch, and high for an erratic
 * sitting up a beach), `r` its plan radius. The MARK (R25) is the one kind
 * the route places rather than the density: the rock the ocean leg is
 * drawn round. */
export type Solid = {
  readonly id: string;
  readonly kind: "skerry" | "boulder" | "reef" | "erratic" | "stack" | "mark";
  readonly x: number;
  readonly z: number;
  readonly r: number;
  readonly top: number;
};

/** A GROUP OF ANIMALS placed in the water (R20): a school of herring, a
 * pair of porpoises, one pike lying over a weed bed. A pod is a PLACE and a
 * BEAT rather than a position — it swims a closed loop, and where any one
 * animal in it is at a moment is `faunaPose` in `engine/game/fauna.ts`, a
 * pure function of the pod and the clock exactly as the sea's surface is a
 * pure function of the point and the clock. Nothing about a pod changes
 * during a run, so nothing has to be stepped or replayed. */
/** R17, R25 — the kinds of rock a coast is STREWN with, at their own
 * density per kilometre. Every kind but the mark, which is not strewn: the
 * route stands one where its ocean leg turns, and there is exactly one. */
export type ScatteredKind = Exclude<Solid["kind"], "mark">;

export type Pod = {
  readonly id: string;
  /** Which animal — a row in `engine/game/defs/fauna.ts`. */
  readonly species: FaunaId;
  /** How many are in it. */
  readonly count: number;
  /** The centre of the loop it swims, world m. */
  readonly x: number;
  readonly z: number;
  /** The loop: its long semi-axis (m), how squashed it is across that
   * (0..1), the compass heading of the long axis, and the seconds to go
   * once round. */
  readonly radius: number;
  readonly ovality: number;
  readonly heading: number;
  readonly period: number;
  /** Which way round (+1 clockwise from above) and where on the loop the
   * pod stands at t = 0, rad. */
  readonly sense: 1 | -1;
  readonly phase: number;
  /** How deep the pod's centreline holds, m below the surface. */
  readonly depth: number;
  /** The seed the formation and every animal's own weave are hashed off, so
   * a pod's scatter is the level's and not a draw at render time. */
  readonly scatter: number;
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
 * fauna is drawn against (R20) — a species is met only in water inside its
 * own band — and what the spray will read later. */
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
  /** THE COASTLINES: the water's edge as polylines, longest first. More
   * than one, because a basin's edge is not one line — the mainland, and
   * one round every island in it (R15). */
  readonly shore: readonly (readonly Vec2[])[];
  /** What the shore is made of at a plan point. (`materialAt`, not
   * `surfaceAt`: the sea's `surfaceAt` is the wave surface.) */
  readonly materialAt: (x: number, z: number) => Surface;
  readonly solids: readonly Solid[];
  /** R26 — THE RIVER, mouth first: the water that carries on inland past
   * the end of the race, thinning to a creek nothing can ride. Published
   * because it is a place — the plan draws it, the analysis walks it — but
   * it is not a separate body of water: it is stamped into `offshore` with
   * the rest, and the hull only ever reads the field. */
  readonly river: readonly Vec2[];
  /** What swims here (R20), in the order it was placed. Read by the
   * renderer through `faunaPose`; nothing in the physics touches it. */
  readonly fauna: readonly Pod[];
  readonly course: Course;
  /** Where the run starts: behind the first gate, pointing at it. */
  readonly start: { readonly x: number; readonly z: number; readonly heading: number };
  readonly wind: Wind;
  readonly water: WaterBody;
  /** Hour of day, 0..24 (R13) — where the sun stands, which is what the
   * renderer's atmosphere builds the whole sky out of. */
  readonly hour: number;
  /** The sky over it (R19). */
  readonly weather: Weather;
};
