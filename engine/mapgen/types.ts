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
import type { Season } from "../lib/solar.ts";

/** The countries the shore can belong to. Only `taiga` is built; the rest are
 * the names the campaign will need, reserved so an id never changes. */
export type BiomeId = "taiga" | "archipelago" | "fjord" | "atoll" | "delta" | "arctic";

/** What the ground is made of where a point of shore stands. */
export type Surface = "bedrock" | "rock" | "sand" | "water";

/** WHICH KIND OF TRACK a level carries, and so which chapter of the rule
 * book it was built to. A `coast` level is a sprint along a stretch of
 * shore, out to a mark and back (R1, R10, R25, R26); a `circuit` is a
 * closed lap out in open water, ridden several times round, with no river
 * and no coastal band (R29–R31). Everything downstream that has to tell
 * the two apart reads `Level.track` — the analysis branches on it, the
 * level plan labels it, and the HUD counts laps by it. */
export type TrackKind = "coast" | "circuit";

/** What to build and how hard to try. */
export type GenerateOptions = {
  /** Defaults to the taiga, the one country built. */
  biome?: BiomeId;
  /** R29 — which chapter of the rule book to build to; defaults to
   * `coast`. */
  track?: TrackKind;
  /** Bounded sub-seed attempts before the generator throws; defaults to
   * `LEVEL_RULES.search.attempts`. */
  attempts?: number;
};

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

/** R31 — THE LIGHT ON A BUOY, as a chart quotes one: `flashes` of them in
 * a group, one group every `period` seconds, and a `phase` of its own so
 * two buoys in sight of each other are never in step. `buoyLightAt` in
 * `engine/game/buoy.ts` is the character as a pure function of the level's
 * clock; nothing about it is stepped or stored. */
export type BuoyLight = {
  readonly flashes: number;
  readonly period: number;
  readonly phase: number;
};

/** Something standing in the water or on the shore beside it: a
 * vertical-axis solid the craft can hit. `top` is its height above SEA
 * level (negative for a reef the hull can still touch, and high for an
 * erratic sitting up a beach), `r` its plan radius. Two kinds are placed by
 * the racing LINE rather than by the density — the MARK (R25), the sea
 * stack a coast level's ocean leg is drawn round, and the BUOY (R31), the
 * moored, lit can a circuit's lap is ridden round — and the buoy is the one
 * that floats and the only one that carries a `light`. */
export type Solid = {
  readonly id: string;
  readonly kind: "skerry" | "boulder" | "reef" | "erratic" | "stack" | "mark" | "buoy";
  readonly x: number;
  readonly z: number;
  readonly r: number;
  readonly top: number;
  /** R31 — the lamp, on a rounding buoy and on nothing else. */
  readonly light?: BuoyLight;
};

/** A GROUP OF ANIMALS placed in the water (R20): a school of herring, a
 * pair of porpoises, one pike lying over a weed bed. A pod is a PLACE and a
 * BEAT rather than a position — it swims a closed loop, and where any one
 * animal in it is at a moment is `faunaPose` in `engine/game/fauna.ts`, a
 * pure function of the pod and the clock exactly as the sea's surface is a
 * pure function of the point and the clock. Nothing about a pod changes
 * during a run, so nothing has to be stepped or replayed. */
/** R17, R25, R31 — the kinds of rock a coast is STREWN with, at their own
 * density per kilometre. Every kind but the two the racing line places:
 * the mark a coast's ocean leg turns round, and the buoys a circuit's lap
 * is ridden round. */
export type ScatteredKind = Exclude<Solid["kind"], "mark" | "buoy">;

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
 * polyline, and its length in metres. The last gate is the finish.
 *
 * R30 — A LAPPED COURSE IS THE LAP CONCATENATED. On a circuit the gates
 * listed here are every gate of every lap in the order they are taken, and
 * the path is the loop ridden `laps` times, because that is what the rider
 * rides and the run engine takes the gates in order without knowing a lap
 * exists. `lapGates` is how many of them one lap is worth — the first
 * `lapGates` entries ARE the lap, and gate `i` and gate `i + lapGates`
 * stand in the same water — so the HUD can count laps and the renderer can
 * draw each buoy once. A circuit therefore lists `laps · lapGates + 1`
 * gates: the one extra is the final crossing of the start line, which is
 * the finish. A coast course is one pass of everything — `laps` is 1 and
 * `lapGates` is the whole gate count. */
export type Course = {
  readonly gates: readonly Gate[];
  readonly path: readonly Vec2[];
  readonly length: number;
  /** R30 — how many times round; 1 on a coast course. */
  readonly laps: number;
  /** R30 — gates in ONE lap. On a coast course this is every gate. */
  readonly lapGates: number;
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

/** R27 — THE CURRENT: the water's own velocity over the plan, m/s, baked
 * as one field per axis over the RIVER'S own box (it is zero everywhere
 * else, and a field of zeroes over a whole level is a megabyte spent
 * saying so). Read through `flowAt`, and summed into the wave model's
 * orbital velocity so that everything which asks the water how fast it is
 * going — the hull's drag, the spray, the wake — feels the river without
 * knowing there is one. */
export type Flow = {
  readonly vx: Heightfield;
  readonly vz: Heightfield;
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
  /** R29 — which chapter of the rule book this level was built to. */
  readonly track: TrackKind;
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
  /** R27 — the water in transit down that river and out of its mouth. */
  readonly flow: Flow;
  /** What swims here (R20), in the order it was placed. Read by the
   * renderer through `faunaPose`; nothing in the physics touches it. */
  readonly fauna: readonly Pod[];
  readonly course: Course;
  /** Where the run starts: behind the first gate, pointing at it. */
  readonly start: { readonly x: number; readonly z: number; readonly heading: number };
  readonly wind: Wind;
  readonly water: WaterBody;
  /** The season (R13): with the coast's latitude, what the sun's arc is —
   * how long the day is, and how dark the night gets. */
  readonly season: Season;
  /** Hour of day, 0..24 (R13) — where the sun stands when the run STARTS;
   * the clock runs on from there (`sunHourAt`), and the renderer's
   * atmosphere builds the whole sky out of wherever it has got to. */
  readonly hour: number;
  /** The sky over it (R19). */
  readonly weather: Weather;
};
