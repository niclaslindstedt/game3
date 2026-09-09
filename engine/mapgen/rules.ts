// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The level generator's RULE BOOK. Every constraint that keeps a generated
// shore inside "coastal reality" — and every constraint that keeps a course
// rideable — lives here as data, separate from the search (generate.ts,
// course.ts), the geometry (compile.ts, geology.ts, shore.ts) and the
// scoreboard (analysis/). The generator BUILDS to these numbers, the
// analysis HOLDS the finished level to the same numbers, and the tests
// assert directly against them; a number changed here changes all three at
// once, which is the point of stating it once.
//
// The rules, in prose (each is enforced in the search or realized in the
// compiler, re-checked by `analyzeLevel`, and asserted across seeds in
// tests/mapgen_test.ts; docs/level-generator.md carries them verbatim):
//
//   R1  THE SHORE IS WITHIN REACH. The course lives beside the land, not out
//       at sea and not on the rocks: every gate and every point of the path
//       stands between `course.offshore.min` (15 m) and `course.offshore.max`
//       (100 m) from the nearest shoreline.
//   R2  LAND ENDS AT 100 m. Only the strip of country the rider can see
//       matters: the ground rises from the waterline to a plateau of
//       `land.plateau` metres inside `land.reach` (100 m) of the shore and
//       is FLAT past it, and nothing on land stands higher than
//       `land.maxHeight` (25 m). No cliffs — this is a glacially planed
//       coast, low bedrock slabs sloping into the water.
//   R3  THE SEA BED FALLS AWAY. Depth grows from nothing at the waterline
//       to `sea.depth` (25 m) at `sea.reach` (250 m) out and never deeper;
//       a bay carries a SHELF, its water `sea.shelf.factor` as deep as the
//       open coast's over the first `sea.shelf.reach` metres.
//   R4  GATES COME EVERY 80–150 m. Consecutive gates are `gate.spacing.min`
//       to `gate.spacing.max` metres apart along the path, and a water
//       gate's buoys stand `gate.width` metres apart.
//   R5  DEEP WATER UNDER THE LINE. The sea is at least `course.minDepth`
//       (1.5 m) deep under every point of the path, start to finish.
//   R6  CLEAR OF THE ROCKS. Every solid — skerry, boulder or reef — keeps
//       at least `course.solidMargin` (6 m) of open water between its edge
//       and the path, and between its edge and every buoy.
//   R7  SOME GATES ARE IN THE AIR. A course carries `air.count.min` to
//       `air.count.max` air gates: rings `air.width` metres across whose
//       centres float `air.height.min` to `air.height.max` metres above the
//       sea. Neither the first gate nor the finish is one, and a ring is
//       followed by `air.landing` metres of clear water to come down in.
//   R8  A RAMP BEFORE EVERY AIR GATE. Each ring has a floating ramp
//       `ramp.lead.min` to `ramp.lead.max` metres before it, ALIGNED with
//       the approach — the ramp's heading is the ring's, and the ring sits
//       on the ramp's axis — of `ramp.length` metres, `ramp.width` wide,
//       rising `ramp.angle` from the water at its hinge.
//   R9  A RUN-UP. The `ramp.runUp` (60 m) of water before a ramp's hinge is
//       STRAIGHT, at least `ramp.runUpDepth` deep, and clear of every solid
//       across the ramp's width plus R6's margin — a rider lines a jump up
//       on the run-up and must not be asked to steer on it.
//   R10 THE COURSE IS A SPRINT. Its length — the path from the start to the
//       finish gate — lands inside `course.length` (1.2–2.0 km).
//   R11 THE START IS BEHIND THE FIRST GATE. The run begins `start.behind`
//       (40 m) before gate 1 on the path, facing it, and the path is
//       straight from the start to that gate.
//   R12 THE WIND BLOWS OFF THE SEA. The mean wind is `wind.speed` m/s, from
//       a compass direction within `wind.seaward` of the direction the
//       open sea lies in — so the fetch grows riding out from the shore and
//       the waves with it.
//   R13 THE DAY AND THE WATER. The run is ridden at an hour inside
//       `day.hour`; the water's temperature comes from the biome's band
//       and its density is the biome's (brackish 1005 kg/m³ on the taiga
//       coast).
//   R14 THE GRID. Both heightfields sit on `grid.cell` (4 m) cells over the
//       course's own extent padded `bounds.sea` metres on the seaward sides
//       and `bounds.land` metres on the landward ones, and the level's
//       bounds ARE the grid's.
//   R15 THE SHORE WANDERS, SMOOTHLY. The coast runs south-west to
//       north-east — a base heading inside `shore.heading` — with the open
//       sea on the RIGHT of that direction, and bays and headlands drawn
//       from the seeded noise at `shore.wander`'s amplitudes; it never
//       doubles back on itself (its offset per metre along the base line
//       stays under `shore.maxSlope`).
//   R16 WHAT THE SHORE IS MADE OF, by rule and in this order: below sea
//       level it is WATER; ground steeper than `surface.bedrockSlope` is
//       BEDROCK; where the boulder noise runs over `surface.boulder`'s
//       threshold it is ROCK (a boulder field); the low ground at the head
//       of a bay deeper than `surface.sand.bay` is SAND, within
//       `surface.sand.reach` of the waterline; everything else is the
//       smoothed BEDROCK slab.
//   R17 THE ROCKS STAND IN THE WATER. Skerries (islets above the sea),
//       boulders (at the waterline) and reefs (tops under the surface) are
//       laid at their kind's density per kilometre of coast, inside their
//       kind's offshore band, with their kind's radius and top, at least
//       `solids.spacing` apart edge to edge — and a reef's top stands proud
//       of the bed under it, or it is not a reef.
//
// The numbers. Every one carries its unit; the R-number beside a group is
// the rule it realizes.

import { TAU } from "../lib/math.ts";
import type { BiomeId } from "./types.ts";

const DEG = TAU / 360;

export type Band = { readonly min: number; readonly max: number };

export const LEVEL_RULES = {
  /** R14 — the heightfield grid. Cell pitch, m: 4 m is under the hull's
   * length, so a buoyancy probe never straddles more than a cell, and a
   * 2 km coast is a few hundred cells a side. */
  grid: { cell: 4 },

  /** R14 — how far the level extends past the course, m. The sea side is
   * where the fetch and the swell are read, so it gets the longer reach;
   * the land side only has to hold the plateau (R2) with room to spare. */
  bounds: { sea: 150, land: 130 },

  /** R15 — the shore's shape. */
  shore: {
    /** Base heading band, rad: north-east give or take. */
    heading: { min: 30 * DEG, max: 60 * DEG },
    /** Polyline vertex spacing along the base line, m. */
    spacing: 10,
    /** Bays and headlands: a broad swing and a finer grain on top, each a
     * value-noise amplitude (m, either side of the base line) at a period
     * (m). The broad period is long against the air gates' straight window
     * (R9 + R8 + R7 ≈ 150 m) so a chord across it does not cut the shore. */
    wander: {
      broad: { amplitude: 40, scale: 600 },
      fine: { amplitude: 8, scale: 150 },
    },
    /** Cap on |d(offset)/ds|, m per m — a shore that runs at more than this
     * to its base line is a fjord, not a Bothnian coast. */
    maxSlope: 0.6,
    /** How far past the course's ends the polyline is drawn, m, so a cell
     * near an end still finds its true nearest shore. */
    margin: 400,
  },

  /** R2 — the land. */
  land: {
    /** Nothing on land stands higher than this, m above sea level. */
    maxHeight: 25,
    /** The plateau begins this far inland, m. */
    reach: 100,
    /** Plateau height band, m: drawn per level. */
    plateau: { min: 8, max: 20 },
    /** The slabs: rounded whalebacks of planed bedrock between the water
     * and the plateau — amplitude m, period m, and the distance from the
     * waterline over which they fade in (m), so the zero contour stays on
     * the shoreline the polyline says. */
    slab: { amplitude: 1.6, scale: 28, fade: 15 },
  },

  /** R3 — the sea bed. */
  sea: {
    /** Depth at the seaward reach and beyond, m. */
    depth: 25,
    /** Distance from the shore at which full depth is reached, m. */
    reach: 250,
    /** A bay's shelf: the bed's depth multiplier at the head of a full bay
     * (`bay`, m of recession, is where the shelf is complete), out to
     * `reach` metres, blending back to the open profile over `blend`. */
    shelf: { factor: 0.55, bay: 40, reach: 80, blend: 70 },
    /** Bed detail: amplitude m, period m, and the fade-in distance from
     * the waterline (m) that keeps the shallows the profile's own. */
    detail: { amplitude: 0.6, scale: 35, fade: 40 },
  },

  /** R16 — the surface classifier. */
  surface: {
    /** Slope at or past which the ground is bare bedrock, m per m. */
    bedrockSlope: 0.12,
    /** The boulder field: value-noise period m and the threshold (0..1)
     * above which the ground is strewn. */
    boulder: { scale: 9, threshold: 0.64 },
    /** A sand pocket: how deep a bay must recede (m) to collect one, how
     * far up from the waterline it reaches (m), and the slope (m per m) it
     * will lie at — sand does not stand on a slab. */
    sand: { bay: 18, reach: 30, slope: 0.08 },
  },

  /** R17 — the rocks. Each kind: count per km of coast, offshore band (m),
   * plan radius band (m), top band (m against sea level). */
  solids: {
    skerry: { perKm: 5, offshore: { min: 35, max: 220 }, r: { min: 3, max: 12 }, top: { min: 0.4, max: 3 } },
    boulder: { perKm: 14, offshore: { min: 4, max: 70 }, r: { min: 0.8, max: 2.5 }, top: { min: -0.4, max: 1 } },
    reef: { perKm: 7, offshore: { min: 20, max: 160 }, r: { min: 2.5, max: 8 }, top: { min: -1.4, max: -0.3 } },
    /** Minimum open water between two rocks, edge to edge, m. */
    spacing: 6,
    /** A reef's top stands at least this far above the bed under it, m. */
    proud: 0.3,
    /** Placement tries per rock before the placer gives up on it. */
    tries: 8,
  },

  /** R1, R5, R6, R10 — the course. */
  course: {
    /** The band the path and every gate keep to, m from the shore. */
    offshore: { min: 15, max: 100 },
    /** The path's own target band inside it, m — the search aims here and
     * lets the shore's slope and the shelves push it about. */
    aim: { min: 25, max: 90 },
    /** Period of the path's wander between the aim band's edges, m. */
    aimScale: 320,
    /** Water under every point of the path, m. */
    minDepth: 1.5,
    /** Open water between a solid's edge and the path or a buoy, m. */
    solidMargin: 6,
    /** Start-to-finish length band, m. */
    length: { min: 1200, max: 2000 },
    /** Where the search aims the finish inside that band, m: the last gate
     * lands up to one spacing short of the target, so the target keeps
     * clear of the floor. */
    target: { min: 1350, max: 1950 },
    /** Station spacing along the shore the path is drawn at, m. */
    station: 10,
  },

  /** R4 — the gates. */
  gate: {
    spacing: { min: 80, max: 150 },
    /** Buoy to buoy, m. */
    width: 12,
  },

  /** R7 — the air gates. */
  air: {
    count: { min: 2, max: 3 },
    /** Ring centre above the sea, m. */
    height: { min: 3, max: 5 },
    /** Ring diameter, m. */
    width: 6,
    /** Clear water past the ring, m. */
    landing: 50,
  },

  /** R8, R9 — the ramps. */
  ramp: {
    /** Hinge to ring, m. */
    lead: { min: 25, max: 40 },
    length: { min: 8, max: 10 },
    width: 4,
    /** Rise from the water, rad. */
    angle: { min: 15 * DEG, max: 22 * DEG },
    /** Straight, clear, deep water before the hinge, m. */
    runUp: 60,
    /** Water under the run-up and the ramp, m. */
    runUpDepth: 2,
  },

  /** R11 — the start. */
  start: { behind: 40 },

  /** R12 — the wind. */
  wind: {
    /** Mean at 10 m, m/s. */
    speed: { min: 2, max: 12 },
    /** How far the direction may swing from dead offshore, rad. */
    seaward: 60 * DEG,
  },

  /** R13 — the day. */
  day: { hour: { min: 6, max: 20 } },

  /** The search's own dials: how many sub-seeds to try before giving up,
   * and the SLACK it builds in over the rules so that the analysis — which
   * reads the baked, bilinear grid rather than the analytic field the
   * search reads — finds the finished level inside the bands. */
  search: {
    attempts: 24,
    /** Extra depth the search demands under the path, m. */
    depthSlack: 0.4,
    /** Extra clearance the placer keeps from the path, m. */
    marginSlack: 1.5,
    /** How far inside R1's band the search keeps the path, m. */
    offshoreSlack: 3,
    /** How far outward the path is pushed when the water is too shallow,
     * m per step, and how many neighbouring stations that push spreads
     * to either side before the line is smoothed. */
    push: { step: 5, spread: 2 },
  },
} as const;

/** A shape-only view for callers that want to write a band without
 * naming the deep type of the rule table. */
export type LevelRules = typeof LEVEL_RULES;

/** Which biome to build and how hard to try. */
export type GenerateOptions = {
  /** Defaults to the taiga, the one country built. */
  biome?: BiomeId;
  /** Bounded sub-seed attempts before the generator throws; defaults to
   * `LEVEL_RULES.search.attempts`. */
  attempts?: number;
};

/** Draw a uniform value inside a band from the seeded stream. */
export function inBand(rng: { range(min: number, max: number): number }, band: Band): number {
  return rng.range(band.min, band.max);
}

/** Is `value` inside a band, with `slack` of tolerance either side? */
export function withinBand(value: number, band: Band, slack = 0): boolean {
  return value >= band.min - slack && value <= band.max + slack;
}
