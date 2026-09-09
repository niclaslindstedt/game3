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
//       matters: the ground rises from the waterline to hills of
//       `land.plateau` metres — taken times `land.hill` by how rugged the
//       coast is there (R21), so a headland stands as a bare rock hill and
//       a bay lies low behind its beach — inside `land.reach` (100 m) of
//       the shore, and past that it STOPS RISING and runs on inland at the
//       height it reached. Nothing on land stands higher than
//       `land.maxHeight` (45 m): rounded glacially planed rock, however
//       high it climbs, and never a cliff.
//   R3  THE SEA BED FALLS AWAY. Depth grows from nothing at the waterline
//       to `sea.depth` (25 m) at `sea.reach` (250 m) out, and keeps falling
//       past it to `sea.openDepth` (60 m) by `sea.openReach` (700 m) — the
//       open sea beyond the coastal shelf, the water a storm swell needs to
//       stand its full height in; a bay carries a SHELF, its water
//       `sea.shelf.factor` as deep as the open coast's over the first
//       `sea.shelf.reach` metres.
//   R4  GATES COME EVERY 80–150 m. Consecutive gates are `gate.spacing.min`
//       to `gate.spacing.max` metres apart along the path, and a water
//       gate's buoys stand `gate.width` metres apart.
//   R5  DEEP WATER UNDER THE LINE. The sea is at least `course.minDepth`
//       (1.5 m) deep under every point of the path, start to finish.
//   R6  CLEAR OF THE ROCKS. Every solid keeps `course.solidMargin` (6 m)
//       of open water between its edge and the path, and between its edge
//       and every buoy — plus `course.solidBerth` of its OWN radius, so the
//       berth a rock is given grows with it: a boulder beside the line is
//       drama, and a sea stack the same distance off it is a wall, because
//       going round one is a metre of steering and going round the other is
//       a corner.
//   R7  SOME GATES ARE IN THE AIR. A course carries `air.count.min` to
//       `air.count.max` air gates: rings `air.width` metres across whose
//       centres float `air.height.min` to `air.height.max` metres above the
//       sea. Neither the first gate nor the finish is one, and a ring is
//       followed by `air.landing` metres of clear water to come down in.
//   R8  A RAMP BEFORE EVERY AIR GATE. Each ring has a floating ramp before
//       it, ALIGNED with the approach — the ramp's heading is the ring's,
//       and the ring sits on the ramp's axis — of `ramp.length` metres
//       along the water, `ramp.width` wide, rising `ramp.angle` from the
//       water at its hinge to a lip `length · tan(angle)` high. How far
//       before the ring the hinge stands is not drawn: R18 derives it from
//       the arc, and `ramp.lead` is only the band that result must land in.
//   R9  A RUN-UP. The `ramp.runUp` (60 m) of water before a ramp's hinge is
//       STRAIGHT, at least `ramp.runUpDepth` deep, and clear of every solid
//       across the ramp's width plus R6's margin — a rider lines a jump up
//       on the run-up and must not be asked to steer on it. It is long
//       enough for the SLOWEST craft in the catalog to reach R18's design
//       speed from a standing start, so a ring is never out of reach for
//       want of road.
//   R10 THE COURSE IS A SPRINT. Its length — the path from the start to the
//       finish gate — lands inside `course.length` (1.2–2.0 km).
//   R11 THE START IS BEHIND THE FIRST GATE. The run begins `start.behind`
//       (40 m) before gate 1 on the path, facing it, and the path is
//       straight from the start to that gate.
//   R12 THE WIND BLOWS OFF THE SEA. The mean wind is `wind.speed` m/s, from
//       a compass direction within `wind.seaward` of the direction the
//       open sea lies in — so the fetch grows riding out from the shore and
//       the waves with it.
//   R13 THE DAY AND THE WATER. The run is ridden in DAYLIGHT: the hour is
//       SOLAR time drawn from the window in which the sun stands at least
//       `day.minSun` over the horizon at the coast's own latitude
//       (`Biome.latitude`, 62°N on the taiga coast), which is what decides
//       where the sun actually stands at it and therefore what sky the run
//       is under. So a seed can be a sunrise on the water, a noon, or a sun
//       going down into the sea, and never a night nobody can read the
//       waves in. The water's temperature comes from the biome's band and
//       its density is the biome's (brackish 1005 kg/m³ on the taiga
//       coast).
//   R14 THE GRID. Both heightfields sit on `grid.cell` (4 m) cells over the
//       course's own extent padded `bounds.sea` metres on the seaward sides
//       and `bounds.land` metres on the landward ones, and the level's
//       bounds ARE the grid's.
//   R15 THE WATER IS A BASIN AROUND THE ROUTE. Three things make it and
//       one is cut back out of them. The CORRIDOR: water within the route's
//       own half-width of the line (`route.corridor`), so every metre of
//       the race stands inside R1's band over R5's water by construction
//       rather than by a search. The OPEN SEA: everything past a straight
//       edge cut `sea.line.edge` metres short of the route's most seaward
//       point, which is where the fetch the waves are built from comes
//       from. And the ISLANDS: `island.count` blobs cut OUT of the water,
//       standing `island.clear` clear of the route, which are the rock a
//       course goes round rather than past. What comes out is ONE SIGNED
//       FIELD — metres from the water's edge, positive in the water — and
//       the coastlines are wherever it crosses zero. So a level's coast
//       doubles back on itself and carries islands, neither of which a
//       single-valued shoreline could express at all; and the share of the
//       level that is water lands inside `basin.waterShare`, which is what
//       keeps a basin from being a canal at one end or an empty sea at the
//       other.
//   R16 WHAT THE SHORE IS MADE OF, by rule and in this order: below sea
//       level it is WATER; ground steeper than `surface.bedrockSlope` is
//       BEDROCK; low ground at the waterline of a stretch softer than
//       `surface.sand.rugged` (R21) is SAND — a BEACH, reaching
//       `surface.sand.reach` up the shore where the stretch is softest and
//       a fraction of that where it barely qualifies; where the boulder
//       noise runs over `surface.boulder`'s threshold it is ROCK, a boulder
//       field, and ruggedness moves that threshold so the fields are thick
//       on a rock coast and absent behind a beach; everything else is the
//       smoothed BEDROCK slab.
//   R17 THE ROCKS STAND ON THE COAST. Skerries (islets above the sea),
//       boulders (at the waterline), reefs (tops under the surface) and
//       ERRATICS — the big glacial blocks left sitting on the shore itself,
//       straddling the waterline — are laid at their kind's density per
//       kilometre of coast, inside their kind's offshore band, with their
//       kind's radius, at least `solids.spacing` apart edge to edge. A kind
//       with a `top` band stands at that height against the SEA; a kind
//       with a `height` band stands that far above the GROUND it sits on,
//       which is the only way to put a rock up a beach, and it must break
//       the surface — a block whose top is under the water is a reef, and
//       there is a kind for that. A reef's own top stands proud of the bed
//       under it, or it is not a reef.
//   R18 THE RING IS REACHABLE. A ring stands where a hull that leaves the
//       lip at the DESIGN LIP SPEED passes — never where a hull would have
//       to be faster than it can be. The design speed is a band,
//       `air.lipSpeed` (50–60 km/h): the arc is drawn from the lip
//       (`length · tan(angle)` up, plus the hull's centre of gravity) at
//       the ramp's angle under `g`, and the ring's centre is set on the
//       SLOW arc — the catalog's lowest-riding hull at the band's floor —
//       at `air.pastApex` times the apex distance past the lip, on its
//       way down, with the FAST arc (the highest-riding hull at the band's
//       ceiling) passing inside the ring's radius less `air.thread`. So the
//       slowest craft threads the ring at a pace it can hold and a faster
//       one still goes through it. The analysis re-derives the speed every
//       catalog craft needs at the hinge (`launchSpeedFor`) and holds it
//       under `air.reach` of the SLOWEST craft's top speed, and inside the
//       design band.
//   R19 THE SKY OVER THE COAST. The run is ridden under one of the skies
//       the biome offers (`Biome.weathers`) — clear, high cloud, overcast,
//       rain or a squall — drawn per seed with the level's OWN WIND
//       weighting the draw: each sky stands at a heaviness on the same 0–1
//       scale R12's wind band is read on, and how far a sky may stand from
//       the wind's place on it and still be likely is `sky.spread`. So the
//       darkest skies stand over the biggest seas, and a calm day is a
//       clear one.
//   R20 WHAT SWIMS HERE. The water carries PODS — a school of herring, a
//       pair of porpoises, one pike lying alone — drawn from the animals
//       the coast offers (`Biome.fauna`), each at its own `perKm` of coast,
//       which is what makes a whale a whale: three orders of magnitude
//       separate the commonest school from the rarest visitor. A pod stands
//       only where its species belongs — inside its offshore band, in water
//       at least its `water` deep the whole way round the loop it swims, at
//       a depth inside its own band, `fauna.clear` clear of every rock —
//       and only when the level's water temperature (R13) falls inside the
//       species' band. Nothing about a pod is ever stepped: it swims that
//       loop as a pure function of the clock, so a run replays the sea life
//       it was ridden through exactly.
//   R21 THE COAST HAS CHARACTER, AND IT CHANGES ALONG THE COAST. Every
//       point of the base line carries a RUGGEDNESS in 0..1, drawn from
//       `shore.character` — high on the headlands, low in the bays — and it
//       is what makes one stretch of a level a different place from the
//       next. A rugged stretch stands as bare rock: its hills climb
//       `land.hill` higher, its slabs break `land.slab.relief` deeper, its
//       boulder fields are thick and its waterline is stone. A soft one
//       lies low behind a sand beach, with a shallow sandy foreshore in
//       front of it. No one material may have the whole coast: the longest
//       unbroken stretch of a single material along the waterline stays
//       under `shore.character.run` metres.
//   R22 THE COURSE IS NOT A STRAIGHT LINE. A race down a straight coast is
//       a throttle held open, so a course has to be STEERED: the path's own
//       length is at least `course.wind` times the straight line from the
//       start to the finish, and the heading swings by at least
//       `course.sweep` radians in total over it. Both come from the coast
//       rather than from the line — the path follows the shore into every
//       inlet and out round every headland (R15) — so a coast that cannot
//       carry a winding course is a coast the search rerolls.
//   R23 EVERY CORNER IS RIDEABLE. No turn on the path is tighter than
//       `course.radius` metres of radius — the tightest circle a planing
//       hull holds at a pace worth riding, and under it a corner stops
//       being a corner and becomes a beach. It is a rule about the SHORE
//       as much as about the line, because the line follows the shore: the
//       head of an inlet is a U the course turns round the INSIDE of, so
//       an inlet's mouth is drawn wide enough (R15) that the radius its
//       head leaves the line is this one.
//   R24 THE ROUTE IS DRAWN FIRST. The racing line is not found along a
//       coast: it is drawn before there is any land, as a walk in the plane
//       that turns at up to `route.swing` of the tightest circle R23
//       allows, is bent back toward the middle when it strays past
//       `route.reach` so a level is a place rather than a departure, and
//       steers away from the legs it has already ridden. A line that comes
//       back on itself inside `route.selfClear` — measured only between
//       points `route.selfSpan` apart ALONG it — is refused rather than
//       shipped, because two legs a rider cannot tell apart are two legs
//       whose gates cross each other. The water is then carved around it
//       (R15), and that is what puts a corner in a course rather than a
//       bend in a coastline.
//
// The numbers. Every one carries its unit; the R-number beside a group is
// the rule it realizes.

import { TAU } from "../lib/math.ts";
import type { BiomeId, Solid } from "./types.ts";

const DEG = TAU / 360;

export type Band = { readonly min: number; readonly max: number };

/** R23's floor, m — the tightest radius the course's line may turn at.
 * Named before the table because two of the table's own entries are stated
 * in terms of it: the rule the finished line is held to, and the mouth
 * width an inlet has to be drawn at for its head not to break it. */
const R_COURSE_RADIUS = 55;

export const LEVEL_RULES = {
  /** R14 — the heightfield grid. Cell pitch, m: 4 m is under the hull's
   * length, so a buoyancy probe never straddles more than a cell, and a
   * 2 km coast is a few hundred cells a side. */
  grid: { cell: 4 },

  /** R14 — how far the level extends past the course, m. The sea side is
   * where the fetch and the swell are read, so it gets the longer reach;
   * the land side only has to hold the plateau (R2) with room to spare. */
  bounds: { sea: 150, land: 130 },

  /** R24 — the route, drawn before there is any land. */
  route: {
    /** How far apart its samples stand, m. */
    step: 10,
    /** How long the line is drawn, m — the band the finish is chosen from
     * sits inside it (R10). */
    length: { min: 1500, max: 2300 },
    /** How hard it turns, as a share of the tightest circle R23 allows: at
     * 1 the line spends whole stretches at the limit, which is a course of
     * hairpins; at the band's floor it is a long open curve. Drawn per
     * level, so one seed is a river run and the next a sweeping bay. */
    swing: { min: 0.45, max: 0.95 },
    /** …over this period of line, m. Long against a gate's spacing (R4) so
     * a corner is a corner rather than a wobble. */
    swingScale: 260,
    /** How far the walk may stray from the middle before it is bent home,
     * m. This is what makes a level a PLACE — a compact basin the rider
     * comes back through — rather than a line receding into the distance. */
    reach: 520,
    /** The corridor of water the line is owed either side of it, m, and the
     * period the width swells over. The band's floor is R1's own minimum
     * offshore, so the narrowest channel still stands the course inside the
     * rule by construction; its ceiling is R1's maximum, so the widest bay
     * never puts the line further out than the rule allows. */
    corridor: { min: 34, max: 95 },
    corridorScale: 340,
    /** R24 — how near the line may come back to itself, m, and how far
     * apart along the line two points have to be for their closeness to
     * count. Two legs inside this are two legs a rider cannot tell apart,
     * and a gate on one is a gate the other crosses. */
    selfClear: 85,
    selfSpan: 220,
    /** How far out the walk starts pushing away from a leg it has already
     * ridden, as a multiple of that clearance, and how hard it pushes
     * against the turn it was going to make anyway. */
    avoidReach: 2.4,
    avoid: 0.85,
  },

  /** R15 — what a traced coastline has to carry. */
  shore: {
    /** How many marching-squares steps a traced coastline must carry to be
     * published as one. A three-cell fleck on the rim of the grid is a
     * rounding, not a coast. */
    minRun: 8,
    /** R21 — the coast's CHARACTER along the base line, 0..1: 0 a soft
     * bay lying behind a beach, 1 a bare rock headland. */
    character: {
      /** Periods of the ruggedness noise, m, and the share of the swing
       * the second one carries. The broad one is long against a gate's
       * spacing (R4, 80–150 m) so a rider crosses two or three characters
       * in a run rather than a new one at every buoy; the finer one is a
       * cove's worth, and it is there because a single 700 m octave gives
       * a 2 km coast only three draws — three highs in a row is a whole
       * level with no beach on it, and half the seeds came out that way. */
      scale: 420,
      detail: { scale: 155, share: 0.36 },
      /** What the coast is on average. Over half, because this is a rock
       * coast with beaches in it and not the other way round: the sand
       * only gets the stretches the noise and the bays push under
       * `surface.sand.rugged`. */
      bias: 0.54,
      /** How far the noise swings it either way. */
      grain: 0.46,
      /** …and how far the coast's own BROAD lie does: a bay collects the
       * sediment the headlands are stripped of, so a recession softens the
       * shore and a headland hardens it, over `swing` m of that swing. */
      shelter: 0.13,
      swing: 90,
      /** R21's quilt: the longest one material may run unbroken along the
       * waterline, m. MEASURED: over forty seeds the longest such run is
       * about 660 m and the mean 300, so a level's coast changes every few
       * gates on its own. A basin's coastlines run to three or four
       * kilometres between them — a channel has two banks and every island
       * has a rim — so the bound is longer than the old single coast's
       * needed, and it still refuses the fault it is here for: a level
       * whose whole waterline is one material. */
      run: 1100,
    },
  },

  /** R2 — the land. */
  land: {
    /** Nothing on land stands higher than this, m above sea level. A rock
     * hill on a headland at 62°N, not an alp: the High Coast's own hills
     * come off the water at about this and the rider sees them the whole
     * run. */
    maxHeight: 45,
    /** The land stops rising this far inland, m. */
    reach: 100,
    /** Height band the land climbs to, m: drawn per level, before the
     * coast's own character has its say. */
    plateau: { min: 8, max: 20 },
    /** R21 — what ruggedness does to that height: a soft stretch keeps
     * `low` of it and lies behind its beach, a rugged one stands `high`
     * times as tall. The product with `plateau`'s ceiling is held under
     * `maxHeight` whatever the draw. */
    hill: { low: 0.45, high: 2 },
    /** The slabs: rounded whalebacks of planed bedrock between the water
     * and the hilltop — amplitude m, period m, and the distance from the
     * waterline over which they fade in (m), so the zero contour stays on
     * the shoreline the polyline says. `relief` is R21's multiplier on the
     * amplitude: smooth sand-backed ground at `low`, broken rock at
     * `high`. */
    slab: { amplitude: 1.6, scale: 28, fade: 15, relief: { low: 0.45, high: 2.2 } },
  },

  /** R3 — the sea bed. */
  sea: {
    /** Depth at the seaward reach, m — the foot of the coastal shelf,
     * and the water every course is ridden in. */
    depth: 25,
    /** Distance from the shore at which that depth is reached, m. */
    reach: 250,
    /** ...and the OPEN SEA past it: the bed goes on falling to
     * `openDepth` m by `openReach` m out. A wave only stands its full
     * height in water it cannot feel the bottom of — the sea is clipped
     * to `TUNING.sea.breakingHs`·d, so twenty-five metres of water holds
     * a fourteen-metre sea and no more, and a storm swell asked for
     * offshore was being flattened by a bed that stopped falling a
     * hundred metres past the last gate. Sixty metres carries a
     * thirty-metre sea, which is past anything the game quotes. The
     * profile inshore of `reach` is untouched, so no course's water
     * moves. */
    openDepth: 60,
    openReach: 700,
    /** The shelf: the bed's depth multiplier where the sediment collects,
     * out to `reach` metres and blending back to the open profile over
     * `blend`. Two things fill it, and the fuller of the two wins — a BAY
     * (`bay`, m of recession, is where the shelf is complete) and a SOFT
     * stretch of coast (R21: at ruggedness 0 the shelf is full, at
     * `rugged` there is none of it), because a sand beach without a
     * shallow foreshore in front of it is a beach that starts in ten
     * metres of water. */
    shelf: { factor: 0.55, bay: 40, rugged: 0.45, reach: 90, blend: 70 },
    /** R15 — how far beyond the route's most seaward reach the open sea's
     * straight edge is cut, m. Inside R1's ceiling, because that is what
     * bounds the race where the water is the sea's rather than the route's
     * own corridor; and past its floor, so the line never runs aground on
     * the sea's own edge. */
    line: { edge: { min: 45, max: 92 } },
    /** Bed detail: amplitude m, period m, and the fade-in distance from
     * the waterline (m) that keeps the shallows the profile's own. */
    detail: { amplitude: 0.6, scale: 35, fade: 40 },
  },

  /** R16 — the surface classifier. */
  surface: {
    /** Slope at or past which the ground is bare bedrock, m per m. */
    bedrockSlope: 0.22,
    /** The boulder field: value-noise period m, the threshold (0..1) above
     * which the ground is strewn, and R21's multiplier on how much of the
     * noise clears it — `low` on the softest coast (a beach has no boulder
     * field behind it), `high` on the most rugged (a moraine shore is
     * mostly boulder).
     *
     * The period is what makes a field a FIELD: the moraine was dumped in
     * patches tens of metres across with meandering edges, and a period
     * near the grid's own cell paints leopard spots instead — visible on
     * `make level` as static over the whole shore rather than as places. */
    boulder: { scale: 58, threshold: 0.6, rugged: { low: 0.25, high: 1.9 } },
    /** A BEACH: the ruggedness (R21) at or under which a stretch carries
     * sand at all, how far up from the waterline the sand reaches on the
     * softest stretch (m) — times `floor` where it only just qualifies, so
     * the beach narrows away rather than ending at a line — and the slope
     * (m per m) sand will lie at, because sand does not stand on a slab. */
    sand: { rugged: 0.34, reach: 45, floor: 0.35, slope: 0.14 },
  },

  /** R15 — what the basin has to come out as. The share of the level that
   * is WATER: under the floor it is a canal cut through solid land, over
   * the ceiling it is an open sea with a fleck of coast on one edge, and
   * neither is a place to race. MEASURED against what the route and the
   * corridor actually draw. */
  basin: { waterShare: { min: 0.3, max: 0.85 } },

  /** R15 — the ISLANDS cut out of the basin: how many a level carries, how
   * big they are (mean plan radius, m), how far clear of the route's own
   * corridor they stand, how much further out than that they may be
   * pushed, how far apart they are kept, how much their rim is warped
   * (0..1 of the radius) and over what share of it. */
  island: {
    count: { min: 1, max: 4 },
    r: { min: 25, max: 95 },
    clear: 18,
    /** How much further out than the clearance one may be pushed, m. Kept
     * short: an island a rider passes at two hundred metres is scenery,
     * and the point of one is the rock the line has to go round. */
    spread: 35,
    apart: 40,
    warp: 0.28,
    warpScale: 1.1,
    tries: 12,
  },

  /** R17 — the rocks. Each kind: count per km of coast, offshore band (m),
   * plan radius band (m), top band (m against sea level). */
  solids: {
    skerry: {
      perKm: 5,
      offshore: { min: 35, max: 220 },
      r: { min: 3, max: 12 },
      top: { min: 0.4, max: 3 },
    },
    boulder: {
      perKm: 14,
      offshore: { min: 4, max: 70 },
      r: { min: 1, max: 3.5 },
      top: { min: -0.4, max: 1.6 },
    },
    reef: {
      perKm: 7,
      offshore: { min: 20, max: 160 },
      r: { min: 2.5, max: 8 },
      top: { min: -1.4, max: -0.3 },
    },
    /** The SEA STACKS: the big rock tops standing out of open water, the
     * things a course goes ROUND rather than past. Rare — a couple a
     * kilometre — because a stack is a landmark and a coast strewn with
     * landmarks has none, and big: `r` and `top` are what make one a rock
     * the rider steers around rather than a skerry to be missed. */
    stack: {
      perKm: 2.5,
      offshore: { min: 30, max: 170 },
      r: { min: 6, max: 15 },
      top: { min: 7, max: 22 },
    },
    /** The glacial ERRATICS: the big blocks the ice dropped on the shore
     * itself. Their band straddles the waterline — inland onto the beach
     * and a little way into the shallows — and their size is stated as a
     * `height` above the GROUND they sit on rather than a `top` against
     * the sea, because a two-metre block halfway up a beach has its foot
     * two metres up as well. They are the biggest rocks on the coast and
     * the ones the rider is closest to. */
    erratic: {
      perKm: 12,
      offshore: { min: -16, max: 14 },
      r: { min: 1.6, max: 4.5 },
      height: { min: 1.2, max: 4 },
    },
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
    /** Open water between a solid's edge and the path or a buoy: this
     * much, m, plus `solidBerth` of the rock's own radius. The share is
     * what makes the rule read the same to a rider whatever the rock is —
     * a 15 m sea stack is given three hull-lengths and a boulder a hull. */
    solidMargin: 6,
    solidBerth: 0.8,
    /** Start-to-finish length band, m. */
    length: { min: 1200, max: 2000 },
    /** Where the search aims the finish inside that band, m: the last gate
     * lands up to one spacing short of the target, so the target keeps
     * clear of the floor. */
    target: { min: 1350, max: 1950 },
    /** Station spacing along the shore the path is drawn at, m. */
    station: 10,
    /** R22 — how much the path must WIND: its length as a multiple of the
     * straight line from the start to the finish, and the total heading
     * change along it, rad. MEASURED against what the coast actually
     * draws, so they refuse the straight runs rather than most of the
     * population. */
    wind: 1.06,
    sweep: 3.5,
    /** R23 — the tightest turn the line may ask for, m of radius. A hull
     * doing 15 m/s round a 60 m radius is pulling 0.38 g sideways, which a
     * planing hull holds on its keel; under about forty the line asks for
     * a corner nothing in the catalog can hold at a pace worth riding, and
     * a rider meets it as a beach rather than as a corner. */
    radius: R_COURSE_RADIUS,
  },

  /** R4 — the gates. */
  gate: {
    spacing: { min: 80, max: 150 },
    /** Buoy to buoy, m. */
    width: 12,
  },

  /** R7, R18 — the air gates. */
  air: {
    count: { min: 2, max: 3 },
    /** The band a ring's DERIVED height (R18) must land in, m above the
     * sea. Not drawn: the arc decides, and this is what it may decide. */
    height: { min: 2.5, max: 5.5 },
    /** Ring diameter, m. */
    width: 6,
    /** Clear water past the ring, m. */
    landing: 50,
    /** R18 — the design lip speed band, m/s (50–60 km/h). A pace every
     * craft in the catalog can hold on a 60 m run-up, and one a rider can
     * feel for: the throttle three-quarters in, not flat out. */
    lipSpeed: { min: 50 / 3.6, max: 60 / 3.6 },
    /** R18 — where on the slow arc the ring sits, as a multiple of the
     * apex distance past the lip: 1 is the apex, 2 is back at lip height.
     * On the way down, so the hull is through the ring before it is
     * looking at the water. */
    pastApex: 1.7,
    /** R18 — how far inside the ring's radius the fast arc must pass, m:
     * half a hull and rider, so a ring "passed" is a ring gone through. */
    thread: 0.8,
    /** R18 — the ceiling on the hinge speed a ring may ask of any craft,
     * as a share of the SLOWEST craft's top speed. MEASURED, not chosen:
     * the band's ceiling on the tallest lip in the vocabulary (10 m at
     * 22°, 4 m up) costs 2·g·lip on top of 60 km/h and comes to 71 km/h
     * at the hinge by the bot's own account, which is 0.93 of the dart's
     * 76; a share under that rejects every steep ramp the ramp band
     * allows, and the search rerolls coasts to find flat ones. */
    reach: 0.95,
  },

  /** R8, R9 — the ramps. */
  ramp: {
    /** The band the DERIVED hinge-to-ring distance (R18) must land in,
     * m. */
    lead: { min: 12, max: 32 },
    /** Deck length along the water, m — the plan footprint; the lip is
     * `length · tan(angle)` up. */
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
    speed: { min: 6, max: 14 },
    /** How far the direction may swing from dead offshore, rad. */
    seaward: 60 * DEG,
  },

  /** R13 — the day: DAYLIGHT, and all of it.
   *
   * The window is not stated as hours because it is not a fact about the
   * clock — it is a fact about the coast. `daylightWindow` reads it off the
   * biome's own latitude, so the same rule gives a taiga seed the 02:22 to
   * 21:38 of a High Coast midsummer and would give a southern one its own
   * shorter day.
   *
   * The floor is the horizon itself: a sun sitting ON the water is the best
   * light this game has and the rider can still read every wave under it,
   * where the civil twilight half an hour later is a grey sea nobody can
   * see a rock in. So sunrise and sunset are in and the night is out —
   * which is the whole of the rule. */
  day: { minSun: 0 },

  /** R19 — the sky. */
  sky: {
    /** How far a sky's own heaviness may stand from the wind's place in
     * R12's band and still be a likely draw, 0..1 of that scale (a
     * Gaussian falloff, so this is its width rather than a cut-off).
     *
     * A third of the scale is the width at which a middling wind can
     * plausibly bring any of the three middle skies while the ends of the
     * band stay nearly settled — the top of `wind.speed` is a squall and
     * the bottom of it a clear day, which is the certainty those two days
     * have to carry or the sea and the sky stop agreeing. */
    spread: 0.32,
  },

  /** R21 — the sea life. The catalog says what each animal is and how
   * often it is met; these are the numbers about the PLACING that are the
   * coast's rather than the animal's. */
  fauna: {
    /** Open water a pod's loop keeps between itself and any rock, m. Half a
     * gate's width: enough that a school reads as swimming beside a skerry
     * rather than through it. */
    clear: 6,
    /** Water under an animal's belly, m — on top of its own body height, so
     * the least water a pod may swim its loop over is its depth plus its
     * girth plus this. What keeps a school from being drawn inside the sea
     * bed on the shallow side of a loop. */
    floor: 0.8,
    /** The loop a pod swims, m — its long semi-axis, drawn per pod. Big
     * enough that a school crosses a rider's view rather than circling in
     * one spot, small enough to stay inside the water its species needs. */
    loop: { min: 12, max: 40 },
    /** How squashed the loop is across its long axis, 0..1: 1 is a circle
     * and the floor is a long thin beat up and down the coast. */
    ovality: { min: 0.25, max: 0.8 },
    /** How far round the loop the pod is checked for water and rocks —
     * more samples is a stricter placement and a slower generator; eight is
     * a sample every 45°, which no loop in the band can hide a rock in. */
    samples: 8,
    /** Placement tries per pod before the placer gives up on it, as R17's
     * rocks are given up on: a coast a little emptier is what a coast is
     * allowed to be. */
    tries: 10,
  },

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

/** R17 — how one kind of rock is placed. A kind states its size EITHER as
 * a `top` against sea level (the kinds that stand in the water) OR as a
 * `height` above the ground it sits on (the kinds that stand on the
 * shore); everything that places or checks a rock branches on which. */
export type SolidRule = {
  readonly perKm: number;
  readonly offshore: Band;
  readonly r: Band;
  readonly top?: Band;
  readonly height?: Band;
};

/** The rule row for a kind of rock, as the shared shape rather than as its
 * own literal type — so a placer or a check can read `top` and `height`
 * without knowing which kind it was handed. */
export function solidRule(kind: Solid["kind"]): SolidRule {
  return LEVEL_RULES.solids[kind];
}

/** Which biome to build and how hard to try. */
export type GenerateOptions = {
  /** Defaults to the taiga, the one country built. */
  biome?: BiomeId;
  /** Bounded sub-seed attempts before the generator throws; defaults to
   * `LEVEL_RULES.search.attempts`. */
  attempts?: number;
};

/** R6 — the open water a rock of radius `r` keeps between its edge and the
 * course's line and buoys, m. Stated here, once, because the placer builds
 * to it, the analysis holds the finished level to it and the tests assert
 * against it — and because "six metres" was true only while every rock was
 * the size of a hull. */
export function solidBerth(r: number): number {
  return LEVEL_RULES.course.solidMargin + r * LEVEL_RULES.course.solidBerth;
}

/** Draw a uniform value inside a band from the seeded stream. */
export function inBand(rng: { range(min: number, max: number): number }, band: Band): number {
  return rng.range(band.min, band.max);
}

/** Is `value` inside a band, with `slack` of tolerance either side? */
export function withinBand(value: number, band: Band, slack = 0): boolean {
  return value >= band.min - slack && value <= band.max + slack;
}
