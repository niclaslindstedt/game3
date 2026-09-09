# The level generator

Levels are built by a rules engine (`engine/mapgen/`), not authored by hand. A level is a stretch of SHORE and the water beside it — the ground as a heightfield against sea level, the shoreline itself, the rocks standing in the water, the race course laid along the shore, and the conditions the run is ridden in — and every one of them is a pure function of the seed. The design splits into files with one job each:

- **`rules.ts` — the rule book.** Every constraint and every vocabulary number lives here as data: how far from the shore the course may run, how deep the water under it must be, how the gates are spaced, what a ramp is, what the land and the sea bed may do, how the rocks stand, what the wind and the day may be. The generator BUILDS to these numbers, the analysis HOLDS the finished level to the same numbers, and the tests assert directly against them. Tuning the generator means editing this file.
- **`biomes.ts` — the coasts.** What a level is built ON, as rows: the water's density and temperature band, how high the land stands, how thickly the rocks lie, whether a bay collects sand. Six ids are reserved so a campaign location never changes its name; one row — the taiga's, the Baltic's northern shore — is built, and asking for another throws.
- **`shore.ts` — the one line everything is measured from.** The coast is a smooth, single-valued offset from a straight base line heading north-east, so "along the shore" and "out from it" are coordinates a search can walk in. The polyline the level publishes is that function sampled every ten metres, and `distanceAt` — the signed distance to it, positive at sea — is what `Level.offshore` is baked from.
- **`geology.ts` — the ground, and the rocks on it.** The sea bed's profile and the shelves in the bays, the land's step up to its plateau and the bedrock slabs riding on it, all analytic in the shore's distance; and the placer that lays skerries, boulders and reefs off the course.
- **`course.ts` — the search.** The path drawn station by station along the shore, pushed seaward until the water under it is deep enough, the gates measured out along it, the straights the air gates need, and the keep-out the placer reads. It also states, once, what a `Ramp`'s anchor means.
- **`generate.ts` — the outer loop.** `generateLevel(seed, opts?)` draws an attempt from a sub-seed, compiles it, analyzes it, and keeps it if it is clean — otherwise rejects it, logs why through the engine's output module, and tries the next sub-seed. Bounded, deterministic, and it throws with the findings when every attempt fails.
- **`compile.ts` — the geometry, once.** Bakes the two heightfields over the course's extent, closes the material classifier (`level.materialAt`) over them, and assembles the read-only `Level` (OSS_GAME_SPEC §24.5: the compile step runs once and nothing downstream regenerates any of it).
- **`fauna.ts`, `weather.ts`** — placeholders for what will live there.

`engine/analysis/` is the generator's scoreboard: `analyzeLevel(level)` re-checks a finished level against every rule in the book, reading only what the level publishes, and returns findings that name the rule they broke. `budgets.ts` beside it holds how closely the checks read — the stride along the path, the tolerance on a stated distance — and never the bands themselves.

## The R-rules

The generator respects coastal reality. Verbatim from the rule book, each enforced in the search (or realized in the compiler), re-checked by `analyzeLevel`, and asserted across seeds in `tests/mapgen_test.ts`:

- **R1** THE SHORE IS WITHIN REACH. The course lives beside the land, not out at sea and not on the rocks: every gate and every point of the path stands between `course.offshore.min` (15 m) and `course.offshore.max` (100 m) from the nearest shoreline.
- **R2** LAND ENDS AT 100 m. Only the strip of country the rider can see matters: the ground rises from the waterline to a plateau of `land.plateau` metres inside `land.reach` (100 m) of the shore and is FLAT past it, and nothing on land stands higher than `land.maxHeight` (25 m). No cliffs — this is a glacially planed coast, low bedrock slabs sloping into the water.
- **R3** THE SEA BED FALLS AWAY. Depth grows from nothing at the waterline to `sea.depth` (25 m) at `sea.reach` (250 m) out, and keeps falling past it to `sea.openDepth` (60 m) by `sea.openReach` (700 m) — the open sea beyond the coastal shelf, the water a storm swell needs to stand its full height in; a bay carries a SHELF, its water `sea.shelf.factor` as deep as the open coast's over the first `sea.shelf.reach` metres.
- **R4** GATES COME EVERY 80–150 m. Consecutive gates are `gate.spacing.min` to `gate.spacing.max` metres apart along the path, and a water gate's buoys stand `gate.width` metres apart.
- **R5** DEEP WATER UNDER THE LINE. The sea is at least `course.minDepth` (1.5 m) deep under every point of the path, start to finish.
- **R6** CLEAR OF THE ROCKS. Every solid — skerry, boulder or reef — keeps at least `course.solidMargin` (6 m) of open water between its edge and the path, and between its edge and every buoy.
- **R7** SOME GATES ARE IN THE AIR. A course carries `air.count.min` to `air.count.max` air gates: rings `air.width` metres across whose centres float `air.height.min` to `air.height.max` metres above the sea. Neither the first gate nor the finish is one, and a ring is followed by `air.landing` metres of clear water to come down in.
- **R8** A RAMP BEFORE EVERY AIR GATE. Each ring has a floating ramp before it, ALIGNED with the approach — the ramp's heading is the ring's, and the ring sits on the ramp's axis — of `ramp.length` metres along the water, `ramp.width` wide, rising `ramp.angle` from the water at its hinge to a lip `length · tan(angle)` high. How far before the ring the hinge stands is not drawn: R18 derives it from the arc, and `ramp.lead` is only the band that result must land in.
- **R9** A RUN-UP. The `ramp.runUp` (60 m) of water before a ramp's hinge is STRAIGHT, at least `ramp.runUpDepth` deep, and clear of every solid across the ramp's width plus R6's margin — a rider lines a jump up on the run-up and must not be asked to steer on it. It is long enough for the SLOWEST craft in the catalog to reach R18's design speed from a standing start, so a ring is never out of reach for want of road.
- **R10** THE COURSE IS A SPRINT. Its length — the path from the start to the finish gate — lands inside `course.length` (1.2–2.0 km).
- **R11** THE START IS BEHIND THE FIRST GATE. The run begins `start.behind` (40 m) before gate 1 on the path, facing it, and the path is straight from the start to that gate.
- **R12** THE WIND BLOWS OFF THE SEA. The mean wind is `wind.speed` m/s, from a compass direction within `wind.seaward` of the direction the open sea lies in — so the fetch grows riding out from the shore and the waves with it.
- **R13** THE DAY AND THE WATER. The run is ridden at an hour inside `day.hour`; the water's temperature comes from the biome's band and its density is the biome's (brackish 1005 kg/m³ on the taiga coast).
- **R14** THE GRID. Both heightfields sit on `grid.cell` (4 m) cells over the course's own extent padded `bounds.sea` metres on the seaward sides and `bounds.land` metres on the landward ones, and the level's bounds ARE the grid's.
- **R15** THE SHORE WANDERS, SMOOTHLY. The coast runs south-west to north-east — a base heading inside `shore.heading` — with the open sea on the RIGHT of that direction, and bays and headlands drawn from the seeded noise at `shore.wander`'s amplitudes; it never doubles back on itself (its offset per metre along the base line stays under `shore.maxSlope`).
- **R16** WHAT THE SHORE IS MADE OF, by rule and in this order: below sea level it is WATER; ground steeper than `surface.bedrockSlope` is BEDROCK; where the boulder noise runs over `surface.boulder`'s threshold it is ROCK (a boulder field); the low ground at the head of a bay deeper than `surface.sand.bay` is SAND, within `surface.sand.reach` of the waterline; everything else is the smoothed BEDROCK slab.
- **R17** THE ROCKS STAND IN THE WATER. Skerries (islets above the sea), boulders (at the waterline) and reefs (tops under the surface) are laid at their kind's density per kilometre of coast, inside their kind's offshore band, with their kind's radius and top, at least `solids.spacing` apart edge to edge — and a reef's top stands proud of the bed under it, or it is not a reef.
- **R18** THE RING IS REACHABLE. A ring stands where a hull that leaves the lip at the DESIGN LIP SPEED passes — never where a hull would have to be faster than it can be. The design speed is a band, `air.lipSpeed` (50–60 km/h): the arc is drawn from the lip (`length · tan(angle)` up, plus the hull's centre of gravity) at the ramp's angle under `g`, and the ring's centre is set on the SLOW arc — the catalog's lowest-riding hull at the band's floor — at `air.pastApex` times the apex distance past the lip, on its way down, with the FAST arc (the highest-riding hull at the band's ceiling) passing inside the ring's radius less `air.thread`. So the slowest craft threads the ring at a pace it can hold and a faster one still goes through it. The analysis re-derives the speed every catalog craft needs at the hinge (`launchSpeedFor`) and holds it under `air.reach` of the SLOWEST craft's top speed, and inside the design band.

## The numbers

Every band above is a row of `LEVEL_RULES`; these are the ones a tuner reaches for first, with their units. The file is the authority — a number here that disagrees with it is a documentation bug.

| Group    | Knob                         | Value             | Unit  | Rule |
| -------- | ---------------------------- | ----------------- | ----- | ---- |
| `grid`   | `cell`                       | 4                 | m     | R14  |
| `bounds` | `sea` / `land`               | 150 / 130         | m     | R14  |
| `shore`  | `heading`                    | 30–60             | °     | R15  |
|          | `wander.broad`               | ±40 over 600      | m     | R15  |
|          | `wander.fine`                | ±8 over 150       | m     | R15  |
|          | `maxSlope`                   | 0.6               | m/m   | R15  |
| `land`   | `maxHeight` / `reach`        | 25 / 100          | m     | R2   |
|          | `plateau`                    | 8–20              | m     | R2   |
|          | `slab.amplitude`             | 1.6               | m     | R2   |
| `sea`    | `depth` / `reach`            | 25 / 250          | m     | R3   |
|          | `openDepth` / `openReach`    | 60 / 700          | m     | R3   |
|          | `shelf.factor`               | 0.55              | —     | R3   |
| `course` | `offshore`                   | 15–100            | m     | R1   |
|          | `aim`                        | 25–90             | m     | R1   |
|          | `minDepth`                   | 1.5               | m     | R5   |
|          | `solidMargin`                | 6                 | m     | R6   |
|          | `length`                     | 1200–2000         | m     | R10  |
| `gate`   | `spacing` / `width`          | 80–150 / 12       | m     | R4   |
| `air`    | `count` / `height` / `width` | 2–3 / 2.5–5.5 / 6 | —, m  | R7   |
|          | `lipSpeed`                   | 50–60             | km/h  | R18  |
|          | `pastApex` / `thread`        | 1.7 / 0.8         | —, m  | R18  |
|          | `reach`                      | 0.95 of slowest   | —     | R18  |
| `ramp`   | `lead` (derived, checked)    | 12–32             | m     | R8   |
|          | `length` (plan) / `width`    | 8–10 / 4          | m     | R8   |
|          | `angle`                      | 15–22             | °     | R8   |
|          | `runUp` / `runUpDepth`       | 60 / 2            | m     | R9   |
| `start`  | `behind`                     | 40                | m     | R11  |
| `wind`   | `speed` / `seaward`          | 6–14 / ±60        | m/s,° | R12  |
| `day`    | `hour`                       | 6–20              | h     | R13  |
| `solids` | `<kind>.perKm`               | 5 / 14 / 7        | /km   | R17  |
| `search` | `attempts`                   | 24                | —     |      |
|          | `depthSlack` / `marginSlack` | 0.4 / 1.5         | m     |      |

The `search` group is the search's own: how many sub-seeds it tries, and the SLACK it builds in over the rules so that the analysis — which reads the baked, bilinear grid rather than the analytic field the search reads — finds the finished level inside the bands.

## The search

1. **The coast.** `createShore` draws a base heading and two noise seeds; the shore's seaward offset is broad value noise plus a finer grain, its slope capped in one pass so the line never doubles back. The open sea is to the RIGHT of the heading — south-east of a north-east coast, as on the Swedish side of the Bothnian Sea.
2. **The ground.** `createGeology` draws the plateau's height and three more noise seeds. The bed is a concave profile of the shore's distance (steep at first, level by 250 m) scaled shallower in a bay; the land is a smooth step to the plateau with the slabs faded out at the waterline and at the reach. Nothing here needs a grid.
3. **The conditions.** Wind from the seaward normal ± 60°, at 6–14 m/s — a fresh breeze most days, a strong one on some; an hour; a water temperature from the biome's band.
4. **The path.** A station every 10 m along the shore, each aiming a slow wander inside 25–90 m out. Every station is pushed seaward, 5 m at a time, until the water under it is deep enough (R5 plus the slack) and it is inside R1's band; the line is smoothed with a `[1, 2, 1]` kernel so the pushes are swells rather than kinks; the pushing repeats until nothing moves. A station that cannot be made legal fails the attempt.
5. **The gates.** Gate 1 at 40 m; then a spacing drawn from 80–150 m, again and again, until the next would pass the target length drawn from 1350–1950 m. The last placed is the finish, and the first 50 m of path are straightened so the start faces gate 1 along it.
6. **The air.** Two or three gate indices are chosen by a seeded shuffle from those that are neither first nor last. For each, a ramp length and angle are drawn and `ringPlacement` derives the ring's distance and height from the design arc (R18); then the window from 60 m before its ramp's hinge to 50 m past its ring is checked as a chord — depth, band — and the path inside it replaced by that chord, in course order, with the distances recomputed each time. Fewer than two legal windows fails the attempt.
7. **The rocks.** Skerries, boulders and reefs are drawn at their densities inside their offshore bands, held to the TRUE distance from the shore, required to stand proud of the bed, kept off the path, the buoys and the air corridors by the course's keep-out, and kept apart from each other. A rock that finds no legal spot is not placed.
8. **The bake.** `compileLevel` sizes the grid from the course's extent plus the paddings, fills both heightfields with one shore lookup per cell, closes the classifier, and assembles the level.
9. **The gate.** `analyzeLevel` re-checks all of it. Clean, and the level ships; not, and the attempt is rejected with its findings in the log, and the next sub-seed goes round again.

Every draw comes off one seeded stream in a fixed order, so the same seed always produces the same level, and the same seed in two different processes agrees to the bit.

## The ramp's anchor

Stated once, in `course.ts`, for everything that reads a `Ramp`: `(x, z)` is the HINGE — the centre of the rear edge, floating at the waterline. The deck runs `length` metres ALONG THE WATER from it in the direction `heading` — `length` is the plan footprint — rising at `angle`, so the lip stands `length · tan(angle)` above the sea. `rampSurface(ramp, x, z)` returns the deck's height at a plan point or `null` beside it, and the collision engine's `rampDeckY` is the same line.

## The ring's place (R18)

A ring is not drawn at a height; it is put where a hull will BE. `ringPlacement(length, angle)` draws two ballistic arcs off the lip under the engine's `g`: the slow one for the catalog's lowest-riding hull at the design band's floor (50 km/h), the fast one for the highest-riding hull at its ceiling (60 km/h). The ring's centre sits at their mean, `air.pastApex` apex-distances past the lip — on the way down, so the hull is through the ring before it is looking at the water — and the two arcs' spread must fit inside the ring's radius less `air.thread`. The search, the analysis and the tests all call the same function, so none of them can put a ring somewhere the others would not. The analysis then asks the bot's own `launchSpeedFor` what hinge speed every catalog craft needs for the ring as built, and fails the level if any of them is above `air.reach` of the slowest craft's top speed or outside the design band.

## Determinism and the corpus

A level is a pure function of its seed and its options. The tests hold that first (`tests/mapgen_test.ts`: two builds of a seed are deep-equal, and the classifier answers the same everywhere), and everything else in the suite depends on it: `tests/support/levels.ts` builds each corpus seed ONCE and hands the same read-only level to every rule's `it`, because a second build could only return the first one's answer and building one is the most expensive thing the engine does.

## Looking at the output

- `make level SEED=38` draws one level: depth shading, the shore, every solid by id, the gates numbered, the ramps, the wind arrow, and a listing of every gate with its offshore distance and depth.
- `make analyze SEED=38` prints the analysis — every finding with its rule, and the stats worth reading when nothing is wrong.
- `tests/mapgen_population_test.ts` reads the generator as a POPULATION: gate counts, air gates, lengths, winds and build times over thirty seeds, held to bands that are inside the rule book's and wide enough to show the seed is choosing. A rules change moves a distribution, and that file is where the movement shows.

## Extending the vocabulary

A new rule takes the next R-number in `rules.ts`'s header, its numbers in `LEVEL_RULES` with their units, its enforcement in the search or the compiler, its re-check in `engine/analysis/index.ts`, an `it` in `tests/mapgen_test.ts`, and its verbatim line in this file — the same day. A rule that lives in fewer than all six places is a rule that will drift.
