# The level generator

Levels are built by a rules engine (`engine/mapgen/`), not authored by hand. A level is a stretch of SHORE and the water beside it — the ground as a heightfield against sea level, the shoreline itself, the rocks standing in the water, the race course laid along the shore, and the conditions the run is ridden in — and every one of them is a pure function of the seed. The design splits into files with one job each:

- **`rules.ts` — the rule book.** Every constraint and every vocabulary number lives here as data: how far from the shore the course may run, how deep the water under it must be, how the gates are spaced, what a ramp is, what the land and the sea bed may do, how the rocks stand, what the wind and the day may be. The generator BUILDS to these numbers, the analysis HOLDS the finished level to the same numbers, and the tests assert directly against them. Tuning the generator means editing this file.
- **`biomes.ts` — the coasts.** What a level is built ON, as rows: the water's density and temperature band, how high the land stands, how thickly the rocks lie, whether a bay collects sand. Six ids are reserved so a campaign location never changes its name; one row — the taiga's, the Baltic's northern shore — is built, and asking for another throws.
- **`shore.ts` — the one line everything is measured from.** The coast is a smooth, single-valued offset from a straight base line heading north-east, so "along the shore" and "out from it" are coordinates a search can walk in. The polyline the level publishes is that function sampled every ten metres, and `distanceAt` — the signed distance to it, positive at sea — is what `Level.offshore` is baked from.
- **`geology.ts` — the ground, and the rocks on it.** The sea bed's profile and the shelves in the bays, the land's step up to its plateau and the bedrock slabs riding on it, all analytic in the shore's distance; and the placer that lays skerries, boulders and reefs off the course.
- **`course.ts` — the search.** The path drawn station by station along the shore, pushed seaward until the water under it is deep enough, the gates measured out along it, the straights the air gates need, and the keep-out the placer reads. It also states, once, what a `Ramp`'s anchor means.
- **`generate.ts` — the outer loop.** `generateLevel(seed, opts?)` draws an attempt from a sub-seed, compiles it, analyzes it, and keeps it if it is clean — otherwise rejects it, logs why through the engine's output module, and tries the next sub-seed. Bounded, deterministic, and it throws with the findings when every attempt fails.
- **`compile.ts` — the geometry, once.** Bakes the two heightfields over the course's extent, closes the material classifier (`level.materialAt`) over them, and assembles the read-only `Level` (OSS_GAME_SPEC §24.5: the compile step runs once and nothing downstream regenerates any of it).
- **`fauna.ts` — what swims here.** The pods (R20) laid along the coast after the course and the rocks are settled: a species drawn from the biome's chart at its own `perKm`, a loop for it to swim, and a bounded search for a spot with the water depth it needs and no rock in the way. What is stored is the LOOP, not a position — where any one animal is at a moment is `engine/game/fauna.ts`'s `faunaPose`, a pure function of the pod and the clock, so nothing about the sea life is ever stepped or replayed.
- **`weather.ts` — the sky (R19).** Which of the biome's skies a seed is ridden under, weighted by the level's own wind.

`engine/analysis/` is the generator's scoreboard: `analyzeLevel(level)` re-checks a finished level against every rule in the book, reading only what the level publishes, and returns findings that name the rule they broke. `budgets.ts` beside it holds how closely the checks read — the stride along the path, the tolerance on a stated distance — and never the bands themselves.

## The R-rules

The generator respects coastal reality. Verbatim from the rule book, each enforced in the search (or realized in the compiler), re-checked by `analyzeLevel`, and asserted across seeds in `tests/mapgen_test.ts`:

- **R1** THE SHORE IS WITHIN REACH. The course lives beside the land, not out at sea and not on the rocks: every gate and every point of the path stands between `course.offshore.min` (15 m) and `course.offshore.max` (100 m) from the nearest shoreline.
- **R2** LAND ENDS AT 100 m. Only the strip of country the rider can see matters: the ground rises from the waterline to hills of `land.plateau` metres — taken times `land.hill` by how rugged the coast is there (R21), so a headland stands as a bare rock hill and a bay lies low behind its beach — inside `land.reach` (100 m) of the shore, and past that it STOPS RISING and runs on inland at the height it reached. Nothing on land stands higher than `land.maxHeight` (45 m): rounded glacially planed rock, however high it climbs, and never a cliff.
- **R3** THE SEA BED FALLS AWAY. Depth grows from nothing at the waterline to `sea.depth` (25 m) at `sea.reach` (250 m) out, and keeps falling past it to `sea.openDepth` (60 m) by `sea.openReach` (700 m) — the open sea beyond the coastal shelf, the water a storm swell needs to stand its full height in; a bay carries a SHELF, its water `sea.shelf.factor` as deep as the open coast's over the first `sea.shelf.reach` metres.
- **R4** GATES COME EVERY 80–150 m. Consecutive gates are `gate.spacing.min` to `gate.spacing.max` metres apart along the path, and a water gate's buoys stand `gate.width` metres apart.
- **R5** DEEP WATER UNDER THE LINE. The sea is at least `course.minDepth` (1.5 m) deep under every point of the path, start to finish.
- **R6** CLEAR OF THE ROCKS. Every solid keeps `course.solidMargin` (6 m) of open water between its edge and the path, and between its edge and every buoy — plus `course.solidBerth` of its OWN radius, so the berth a rock is given grows with it: a boulder beside the line is drama, and a sea stack the same distance off it is a wall, because going round one is a metre of steering and going round the other is a corner.
- **R7** SOME GATES ARE IN THE AIR. A course carries `air.count.min` to `air.count.max` air gates: rings `air.width` metres across whose centres float `air.height.min` to `air.height.max` metres above the sea. Neither the first gate nor the finish is one, and a ring is followed by `air.landing` metres of clear water to come down in.
- **R8** A RAMP BEFORE EVERY AIR GATE. Each ring has a floating ramp before it, ALIGNED with the approach — the ramp's heading is the ring's, and the ring sits on the ramp's axis — of `ramp.length` metres along the water, `ramp.width` wide, rising `ramp.angle` from the water at its hinge to a lip `length · tan(angle)` high. How far before the ring the hinge stands is not drawn: R18 derives it from the arc, and `ramp.lead` is only the band that result must land in.
- **R9** A RUN-UP. The `ramp.runUp` (160 m) of water before a ramp's hinge is STRAIGHT, at least `ramp.runUpDepth` deep, and clear of every solid across the ramp's width plus R6's margin — a rider lines a jump up on the run-up and must not be asked to steer on it. It is long enough for the SLOWEST craft in the catalog to reach R18's design speed from a corner exit in the sea the level carries, so a ring is never out of reach for want of road. And it CROSSES the sea: the angle between the way the run-up runs and the way the waves travel is within `ramp.beam` of a right angle. A hull driving into a head sea stuffs its bow, and one running with a following sea cannot climb past the wave in front of it; either way it arrives at the lip too slow for the arc the ring stands on. The rule only had to be written down when the course was drawn before the land (R24) and could run in any direction — a course laid along a coast the wind blows off (R12) is beam-on by construction.
- **R10** THE COURSE IS A SPRINT. Its length — the path from the start to the finish gate — lands inside `course.length` (1.2–2.0 km).
- **R11** THE START IS BEHIND THE FIRST GATE. The run begins `start.behind` (40 m) before gate 1 on the path, facing it, and the path is straight from the start to that gate.
- **R12** THE WIND BLOWS OFF THE SEA. The mean wind is `wind.speed` m/s, from a compass direction within `wind.seaward` of the direction the open sea lies in — so the fetch grows riding out from the shore and the waves with it.
- **R13** THE DAY AND THE WATER. The run is ridden in DAYLIGHT: the hour is SOLAR time drawn from the window in which the sun stands at least `day.minSun` over the horizon at the coast's own latitude (`Biome.latitude`, 62°N on the taiga coast), which is what decides where the sun actually stands at it and therefore what sky the run is under. So a seed can be a sunrise on the water, a noon, or a sun going down into the sea, and never a night nobody can read the waves in. The water's temperature comes from the biome's band and its density is the biome's (brackish 1005 kg/m³ on the taiga coast).
- **R14** THE GRID. Both heightfields sit on `grid.cell` (4 m) cells over the course's own extent padded `bounds.sea` metres on the seaward sides and `bounds.land` metres on the landward ones, and the level's bounds ARE the grid's.
- **R15** THE WATER IS A BASIN AROUND THE ROUTE. Three things make it and one is cut back out of them. The CORRIDOR: water within the route's own half-width of the line (`route.corridor`), so every metre of the race stands inside R1's band over R5's water by construction rather than by a search. The OPEN SEA: everything past a straight edge cut `sea.line.edge` metres short of the route's most seaward point, which is where the fetch the waves are built from comes from. And the ISLANDS: `island.count` blobs cut OUT of the water, standing `island.clear` clear of the route, which are the rock a course goes round rather than past. What comes out is ONE SIGNED FIELD — metres from the water's edge, positive in the water — and the coastlines are wherever it crosses zero. So a level's coast doubles back on itself and carries islands, neither of which a single-valued shoreline could express at all; and the share of the level that is water lands inside `basin.waterShare`, which is what keeps a basin from being a canal at one end or an empty sea at the other.
- **R16** WHAT THE SHORE IS MADE OF, by rule and in this order: below sea level it is WATER; ground steeper than `surface.bedrockSlope` is BEDROCK; low ground at the waterline of a stretch softer than `surface.sand.rugged` (R21) is SAND — a BEACH, reaching `surface.sand.reach` up the shore where the stretch is softest and a fraction of that where it barely qualifies; where the boulder noise runs over `surface.boulder`'s threshold it is ROCK, a boulder field, and ruggedness moves that threshold so the fields are thick on a rock coast and absent behind a beach; everything else is the smoothed BEDROCK slab.
- **R17** THE ROCKS STAND ON THE COAST. Skerries (islets above the sea), boulders (at the waterline), reefs (tops under the surface) and ERRATICS — the big glacial blocks left sitting on the shore itself, straddling the waterline — are laid at their kind's density per kilometre of coast, inside their kind's offshore band, with their kind's radius, at least `solids.spacing` apart edge to edge. A kind with a `top` band stands at that height against the SEA; a kind with a `height` band stands that far above the GROUND it sits on, which is the only way to put a rock up a beach, and it must break the surface — a block whose top is under the water is a reef, and there is a kind for that. A reef's own top stands proud of the bed under it, or it is not a reef.
- **R18** THE RING IS REACHABLE. A ring stands where a hull that leaves the lip at the DESIGN LIP SPEED passes — never where a hull would have to be faster than it can be. The design speed is a band, `air.lipSpeed` (50–60 km/h): the arc is drawn from the lip (`length · tan(angle)` up, plus the hull's centre of gravity) at the ramp's angle under `g`, and the ring's centre is set on the SLOW arc — the catalog's lowest-riding hull at the band's floor — at `air.pastApex` times the apex distance past the lip, on its way down, with the FAST arc (the highest-riding hull at the band's ceiling) passing inside the ring's radius less `air.thread`. So the slowest craft threads the ring at a pace it can hold and a faster one still goes through it. The analysis re-derives the speed every catalog craft needs at the hinge (`launchSpeedFor`) and holds it under `air.reach` of the SLOWEST craft's top speed, and inside the design band.
- **R19** THE SKY OVER THE COAST. The run is ridden under one of the skies the biome offers (`Biome.weathers`) — clear, high cloud, overcast, rain or a squall — drawn per seed with the level's OWN WIND weighting the draw: each sky stands at a heaviness on the same 0–1 scale R12's wind band is read on, and how far a sky may stand from the wind's place on it and still be likely is `sky.spread`. So the darkest skies stand over the biggest seas, and a calm day is a clear one.
- **R20** WHAT SWIMS HERE. The water carries PODS — a school of herring, a pair of porpoises, one pike lying alone — drawn from the animals the coast offers (`Biome.fauna`), each at its own `perKm` of coast, which is what makes a whale a whale: three orders of magnitude separate the commonest school from the rarest visitor. A pod stands only where its species belongs — inside its offshore band, in water at least its `water` deep the whole way round the loop it swims, at a depth inside its own band, `fauna.clear` clear of every rock — and only when the level's water temperature (R13) falls inside the species' band. Nothing about a pod is ever stepped: it swims that loop as a pure function of the clock, so a run replays the sea life it was ridden through exactly.
- **R21** THE COAST HAS CHARACTER, AND IT CHANGES ALONG THE COAST. Every point of the base line carries a RUGGEDNESS in 0..1, drawn from `shore.character` — high on the headlands, low in the bays — and it is what makes one stretch of a level a different place from the next. A rugged stretch stands as bare rock: its hills climb `land.hill` higher, its slabs break `land.slab.relief` deeper, its boulder fields are thick and its waterline is stone. A soft one lies low behind a sand beach, with a shallow sandy foreshore in front of it. No one material may have the whole coast: the longest unbroken stretch of a single material along the waterline stays under `shore.character.run` metres.
- **R22** THE COURSE IS NOT A STRAIGHT LINE. A race down a straight coast is a throttle held open, so a course has to be STEERED: the path's own length is at least `course.wind` times the straight line from the start to the finish, and the heading swings by at least `course.sweep` radians in total over it. Both come from the coast rather than from the line — the path follows the shore into every inlet and out round every headland (R15) — so a coast that cannot carry a winding course is a coast the search rerolls.
- **R23** EVERY CORNER IS RIDEABLE. No turn on the path is tighter than `course.radius` metres of radius — the tightest circle a planing hull holds at a pace worth riding, and under it a corner stops being a corner and becomes a beach. It is a rule about the SHORE as much as about the line, because the line follows the shore: the head of an inlet is a U the course turns round the INSIDE of, so an inlet's mouth is drawn wide enough (R15) that the radius its head leaves the line is this one.
- **R24** THE ROUTE IS DRAWN FIRST. The racing line is not found along a coast: it is drawn before there is any land, as a walk in the plane that turns at up to `route.swing` of the tightest circle R23 allows, is bent back toward the middle when it strays past `route.reach` so a level is a place rather than a departure, and steers away from the legs it has already ridden. A line that comes back on itself inside `route.selfClear` — measured only between points `route.selfSpan` apart ALONG it — is refused rather than shipped, because two legs a rider cannot tell apart are two legs whose gates cross each other. The water is then carved around it (R15), and that is what puts a corner in a course rather than a bend in a coastline.

## What swims here

R20's roster is the one piece of level content that is drawn from a CATALOG rather than from the rule book: `engine/game/defs/fauna.ts` states each animal — how long it is, how fast, how deep it holds, how many travel together, how often it must breathe, and the water temperature it is met in — and, above all, `perKm`, how many pods of it a kilometre of coast carries. That last number spans three orders of magnitude, and it is the whole design: a coast where every animal turned up every ride would have no animals on it, only scenery.

`rarityOf(perKm)` turns the number into the word, so the two can never disagree. On the taiga coast, over a couple of kilometres of shore:

| Animal               | Pods per km | Rarity    | Travels in | Roughly            |
| -------------------- | ----------- | --------- | ---------- | ------------------ |
| Baltic herring       | 3.4         | common    | 14–30      | six schools a ride |
| Roach                | 2.2         | common    | 8–20       | four schools       |
| Perch                | 1.7         | common    | 5–12       | three schools      |
| Pike                 | 0.55        | uncommon  | 1          | one most rides     |
| Sea trout            | 0.42        | uncommon  | 2–5        | one most rides     |
| Harbour porpoise     | 0.16        | scarce    | 1–3        | one ride in three  |
| White-beaked dolphin | 0.075       | rare      | 3–8        | one ride in seven  |
| Porbeagle            | 0.04        | rare      | 1–2        | one ride in twelve |
| Killer whale         | 0.02        | legendary | 2–5        | one ride in forty  |
| Minke whale          | 0.011       | legendary | 1–2        | one ride in sixty  |

The five fish and the porpoise are the Bothnian Sea's own. The dolphin, the porbeagle, the orca and the minke are Atlantic animals that stray into the Baltic a handful of times a century; they are in the catalog because the game wants them, and they are as rare as it can make them and still be reachable.

`make level SEED=n` prints the roster a seed drew, and `make analyze` counts the pods and the animals per level.

## The numbers

Every band above is a row of `LEVEL_RULES`; these are the ones a tuner reaches for first, with their units. The file is the authority — a number here that disagrees with it is a documentation bug.

| Group    | Knob                          | Value                 | Unit   | Rule    |
| -------- | ----------------------------- | --------------------- | ------ | ------- |
| `grid`   | `cell`                        | 4                     | m      | R14     |
| `bounds` | `sea` / `land`                | 150 / 130             | m      | R14     |
| `shore`  | `heading`                     | 30–60                 | °      | R15     |
|          | `wander.broad`                | ±150 over 480         | m      | R15     |
|          | `wander.fine`                 | ±16 over 170          | m      | R15     |
|          | `maxSlope`                    | 2.8                   | m/m    | R15     |
|          | `inlet.count` / `.depth`      | 2–3 / 80–200          | —, m   | R15     |
|          | `character.run`               | 800                   | m      | R21     |
| `land`   | `maxHeight` / `reach`         | 45 / 100              | m      | R2      |
|          | `plateau`                     | 8–20                  | m      | R2      |
|          | `slab.amplitude`              | 1.6                   | m      | R2      |
|          | `hill` (× the plateau)        | 0.45–2                | —      | R2, R21 |
| `sea`    | `depth` / `reach`             | 25 / 250              | m      | R3      |
| `sea`    | `openDepth` / `openReach`     | 60 / 700              | m      | R3      |
|          | `shelf.factor`                | 0.55                  | —      | R3      |
| `course` | `offshore`                    | 15–100                | m      | R1      |
|          | `aim`                         | 25–90                 | m      | R1      |
|          | `minDepth`                    | 1.5                   | m      | R5      |
|          | `solidMargin` / `solidBerth`  | 6 + 0.8 × radius      | m      | R6      |
|          | `length`                      | 1200–2000             | m      | R10     |
|          | `wind` / `sweep`              | 1.06 / 3.5            | ×, rad | R22     |
|          | `radius`                      | 55                    | m      | R23     |
| `gate`   | `spacing` / `width`           | 80–150 / 12           | m      | R4      |
| `air`    | `count` / `height` / `width`  | 2–3 / 2.5–5.5 / 6     | —, m   | R7      |
|          | `lipSpeed`                    | 50–60                 | km/h   | R18     |
|          | `pastApex` / `thread`         | 1.7 / 0.8             | —, m   | R18     |
|          | `reach`                       | 0.95 of slowest       | —      | R18     |
| `ramp`   | `lead` (derived, checked)     | 12–32                 | m      | R8      |
|          | `length` (plan) / `width`     | 8–10 / 4              | m      | R8      |
|          | `angle`                       | 15–22                 | °      | R8      |
|          | `runUp` / `runUpDepth`        | 160 / 2               | m      | R9      |
|          | `beam`                        | 30                    | °      | R9      |
| `start`  | `behind`                      | 40                    | m      | R11     |
| `wind`   | `speed` / `seaward`           | 6–14 / ±60            | m/s,°  | R12     |
| `day`    | `minSun` (the window's floor) | 0                     | °      | R13     |
| `sky`    | `spread`                      | 0.32                  | —      | R19     |
| `solids` | `<kind>.perKm`                | 5 / 14 / 7 / 12 / 2.5 | /km    | R17     |
|          | `erratic.height`              | 1.2–4 over ground     | m      | R17     |
|          | `stack.r` / `.top`            | 6–15 / 7–22           | m      | R17     |
| `search` | `attempts`                    | 24                    | —      |         |
|          | `depthSlack` / `marginSlack`  | 0.4 / 1.5             | m      |         |

The `search` group is the search's own: how many sub-seeds it tries, and the SLACK it builds in over the rules so that the analysis — which reads the baked, bilinear grid rather than the analytic field the search reads — finds the finished level inside the bands.

## The search

1. **The coast.** `createShore` draws a base heading and four noise seeds; the shore's seaward offset is broad value noise plus a finer grain, less the INLETS — two or three cosine notches, one to a slot along the stretch the course will use, each drawn at the mouth width its own depth needs for its sides to stay under the slope cap (R15) and its head to leave the course a corner it can hold (R23). The line is then capped, smoothed and capped again, so it never doubles back and carries no kink. It also carries a CHARACTER along it (R21), high on the headlands and low in the bays, which everything from the hills to the beaches to the boulder fields reads. The open sea is to the RIGHT of the heading — south-east of a north-east coast, as on the Swedish side of the Bothnian Sea.
2. **The ground.** `createGeology` draws the height the land climbs to and three more noise seeds. The bed is a concave profile of the shore's distance (steep at first, level by 250 m), scaled shallower where the sediment collects — a bay, or a soft stretch of coast, whichever fills the shelf further, which is what a beach's own foreshore is. The land is a smooth step to the HILL this stretch carries (the drawn height times R21's `land.hill`), with the slabs — deeper on a rugged stretch — faded out at the waterline and at the reach. Nothing here needs a grid.
3. **The conditions.** Wind from the seaward normal ± 60°, at 6–14 m/s — a fresh breeze most days, a strong one on some; an hour from the coast's own DAYLIGHT window (R13), so a seed is a sunrise, a noon or a sun going down and never a night; a water temperature from the biome's band.
4. **The path.** A station every 10 m along the shore, each aiming a slow wander inside 25–90 m out. Every station is pushed seaward, 5 m at a time, until the water under it is deep enough (R5 plus the slack) and it is inside R1's band; the line is smoothed with a `[1, 2, 1]` kernel so the pushes are swells rather than kinks; the pushing repeats until nothing moves. A station that cannot be made legal fails the attempt.
5. **The gates.** Gate 1 at 40 m; then a spacing drawn from 80–150 m, again and again, until the next would pass the target length drawn from 1350–1950 m. The last placed is the finish, and the first 50 m of path are straightened so the start faces gate 1 along it.
6. **The air.** Two or three gate indices are chosen by a seeded shuffle from those that are neither first nor last. For each, a ramp length and angle are drawn and `ringPlacement` derives the ring's distance and height from the design arc (R18); then the window from 60 m before its ramp's hinge to 50 m past its ring is checked as a chord — depth, band — and the path inside it replaced by that chord, in course order, with the distances recomputed each time. Fewer than two legal windows fails the attempt.
7. **The rocks.** Sea stacks first (they are the biggest and want the open water), then skerries, boulders, reefs and the erratics on the shore itself, each at its density inside its offshore band, held to the TRUE distance from the shore, required to stand proud of the bed — and, for a kind stated as a height above the ground, to break the surface — kept off the path, the buoys and the air corridors by the course's keep-out with the berth its own radius earns (R6), and kept apart from each other. A rock that finds no legal spot is not placed.
8. **The sky.** Last of the draws, and deliberately so: no sky makes a coast unrideable, so a rule about the weather has no business moving the shore, the course or the rocks the draws before it made. `pickWeather` reads the wind already drawn as a heaviness (`skyCover`) and picks from the biome's chart with it (R19).
9. **The bake.** `compileLevel` sizes the grid from the course's extent plus the paddings, fills both heightfields with one shore lookup per cell, closes the classifier, and assembles the level.
10. **The gate.** `analyzeLevel` re-checks all of it. Clean, and the level ships; not, and the attempt is rejected with its findings in the log, and the next sub-seed goes round again.

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
