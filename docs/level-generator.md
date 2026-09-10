# The level generator

Levels are built by a rules engine (`engine/mapgen/`), not authored by hand. A level is a stretch of SHORE and the water beside it — the ground as a heightfield against sea level, the shoreline itself, the rocks standing in the water, the race course laid along the shore, and the conditions the run is ridden in — and every one of them is a pure function of the seed. The design splits into files with one job each:

- **`rules.ts` — the rule book.** Every constraint and every vocabulary number lives here as data: how far from the shore the course may run, how deep the water under it must be, how the gates are spaced, what a ramp is, what the land and the sea bed may do, how the rocks stand, what the wind and the day may be. The generator BUILDS to these numbers, the analysis HOLDS the finished level to the same numbers, and the tests assert directly against them. Tuning the generator means editing this file.
- **`biomes.ts` — the coasts.** What a level is built ON, as rows: the water's density and temperature band, how high the land stands, how thickly the rocks lie, whether a bay collects sand. Six ids are reserved so a campaign location never changes its name; one row — the taiga's, the Baltic's northern shore — is built, and asking for another throws.
- **`shore.ts` — the one line everything is measured from.** The coast is a smooth, single-valued offset from a straight base line heading north-east, so "along the shore" and "out from it" are coordinates a search can walk in. The polyline the level publishes is that function sampled every ten metres, and `distanceAt` — the signed distance to it, positive at sea — is what `Level.offshore` is baked from.
- **`geology.ts` — the ground, and the rocks on it.** The sea bed's profile and the shelves in the bays, the land's step up to its plateau and the bedrock slabs riding on it, all analytic in the shore's distance; and the placer that lays skerries, boulders and reefs off the course.
- **`course.ts` — the search.** The path drawn station by station along the shore, pushed seaward until the water under it is deep enough, the gates measured out along it, the straights the air gates need, and the keep-out the placer reads. It also states, once, what a `Ramp`'s anchor means.
- **`generate.ts` — the outer loop.** `generateLevel(seed, opts?)` draws an attempt from a sub-seed, compiles it, analyzes it, and keeps it if it is clean — otherwise rejects it, logs why through the engine's output module, and tries the next sub-seed. Bounded, deterministic, and it throws with the findings when every attempt fails.
- **`compile.ts` — the geometry, once.** Bakes the two heightfields over the course's extent and R27's current over the river's own box, closes the material classifier (`level.materialAt`) over them, and assembles the read-only `Level` (OSS_GAME_SPEC §24.5: the compile step runs once and nothing downstream regenerates any of it).
- **`flow.ts` — the river in transit (R27).** Turns the river's discharge and the bed under it into two baked velocity fields, read by `flowAt` and summed into the wave model's own velocity, so a craft sitting still on a river is not sitting still.
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
- **R12** THE WIND BLOWS OFF THE SEA, ALWAYS. The mean wind is `wind.speed` m/s, from a compass direction within `wind.seaward` of the direction the open sea lies in — NEVER off the land. The band is under a right angle at both ends, so the wind drives at the coast on every seed: a wind blowing out to sea is a shore with no waves against it, which is the one sea this game has no use for. What it buys is R28 — with the ocean upwind of the whole coast, the sea reaches every metre of it.
- **R13** THE DAY AND THE WATER. The run STARTS in daylight: the level is dealt a SEASON, and its hour is SOLAR time drawn from the window in which the sun stands at least `day.minSun` over the horizon at the coast's own latitude (`Biome.latitude`, 62°N on the taiga coast) in that season, which is what decides where the sun actually stands at it and therefore what sky the run is under. So a seed can be a sunrise on the water, a noon, or a sun going down into the sea — and the clock runs on from there at an hour a minute (`sunHourAt`), so a run begun at sunset rides into the twilight and then the night, and how dark that night gets is the season's: a taiga midsummer never gets past twilight, a September night is black under the moon. The water's temperature comes from the biome's band for the season and its density is the biome's (brackish 1005 kg/m³ on the taiga coast).
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
- **R25** THE COURSE GOES OUT TO THE OCEAN, AND ROUNDS A MARK. One stretch of the route — `leg.span` metres of it, leaving the coast at `leg.at` — turns off the shore, runs out past R1's ceiling into open water and comes back on the heading it left on. It is drawn with one radius (`leg.round`, never under R23's): a quarter turn out, a straight run of `leg.out`, a HALF CIRCLE round the mark, the same run back, and the turn that puts it back on the coast. The MARK stands at the centre of that half circle — the one rock in the vocabulary a course is drawn ROUND rather than past, over twenty metres of it out of the water (`solids.mark`), and the only thing in a level placed by the route rather than by density. The leg's furthest point stands `leg.offshore` from the shore, and inside `mark.zone` of the mark R1's ceiling gives way to this rule: everywhere else on the path it still holds.
- **R26** THE RIVER RUNS ON PAST THE RACE. The route's inland end is a MOUTH, and the water does not stop at it: a river carries on from there into the country for `river.length` of walking, meandering under `river.radius` of curvature but pulled inland the whole way, until its head stands at least `river.inland` (1 km) from the mouth. It THINS as it goes — `river.taper` from the corridor's own half-width at the mouth to `river.head` at the head — and because the bed is a function of the distance from the water's edge (R3), a channel that narrows shoals with itself: the last stretch is a creek too thin and too shallow to ride, which is where a rider roaming upstream stops. Past its mouth's own run it keeps `river.clear` off the racing line, so the water a rider can leave the course by is one mouth and not three.
- **R27** THE RIVER RUNS, AND WHAT IS CONSERVED IS THE VOLUME. It carries `river.discharge` cubic metres a second out of its mouth, and the SPEED is what is left when that volume has to fit through the channel: v = Q/A over the cross-section the half-width and the level's own bed make there — slow across the wide, deep reach at the mouth, quickening as the banks close in, fastest on the centreline and nothing at the bank. A section further up carries `flow.gather` power of the mouth's water, because a river's catchment grows the whole way down and that is why it widens; past the mouth it fans into the basin over `flow.plume` metres and dies. The hull reads it as the water's own velocity, so a craft sitting still on a river is not sitting still.
- **R28** THE OCEAN'S SEA REACHES WHAT THE OCEAN CAN SEE. A level holds two kinds of water and they do not carry the same waves. Every point is measured for what stands UPWIND of it — the effective fetch over a fan about the wind (SPM 1984) — and is dealt the sea that measurement earns: water with the open sea upwind carries the ocean's own swell, which under R12 is the whole coast, so the waves come in AGAINST the shore; water land has closed round carries only the chop the local wind grew on the few metres it crossed, so a river has small, short, wind-made waves and no ocean in it however wide its mouth. The WIND is read through the same measurement — full strength over the open water, a fraction of it over a river a kilometre inland with country all round.
- **R29** THE OCEAN CIRCUIT: OUT FROM THE SHORE AND BACK. A level may be drawn as a CIRCUIT rather than as a stretch of coast, and then the race is a CLOSED LAP that begins at the beach, tracks the shore for a stretch, turns out into the open sea, rounds what is standing out there and comes back in to cross the line it started on. There is NO RIVER on one: neither R26 nor R27 applies. R1's coastal band gives way to the lap's own two ends — its most inshore station stands `circuit.inshore` off the water's edge, its most seaward one `circuit.reach` out past it, and `circuit.ashore` of the lap's length is ridden inside R1's own ceiling, which is what makes the shore leg a leg rather than a place the line touches once. The shape is polar: a mean radius bulged toward the sea by `circuit.bulge`, stretched ALONG the coast by `circuit.stretch` so the inshore run is flat, and warped by `circuit.harmonics` harmonics of `circuit.swing` for character. It holds R23's own turning radius, keeps `circuit.selfClear` between the stretches of itself that stand `circuit.selfSpan` apart along it, and turns `circuit.turn` radians in all going round once — a plain circle turns 2π and nothing else, so only a loop with counter bends in it turns further.
- **R30** THE CIRCUIT IS LAPPED. A circuit is ridden `circuit.laps` times round. The gates are measured out ONCE round the loop at a spacing inside R4's band that divides the lap EXACTLY, so the last gate of a lap leads back into the first; the course is that lap repeated, with one more crossing of the line at the end of it, and so the FINISH LINE IS THE START LINE. What a lapped course publishes is the whole ride — every gate of every lap, in the order they are taken — because that is what is ridden, and `Course.laps` and `Course.lapGates` say how to read it back as laps. R10's sprint band gives way to `circuit.length`, which is the whole ride; R7's air gates are counted over that whole ride, so one ramp a lap is the whole of a circuit's air.
- **R31** EVERY LAP IS RIDDEN ROUND LIT BUOYS. `circuit.mark.count` of the loop's own bends carry a BUOY at the centre of the turn — a moored steel can (`solids.buoy`) riding the swell with a lantern in a cage over it — and at least one of them stands out past `circuit.mark.ocean` from the shore, so every lap includes a run out into the open sea to round something and back. A bend earns one by turning at least `circuit.mark.wrap` radians about the buoy with the buoy standing `circuit.mark.stand` off the line: nearer than the band's floor there is no room for R6's berth, and further out than its ceiling the rider passes a buoy on the horizon rather than rounding one. Two buoys may not stand within `circuit.mark.apart` of each other along the lap, because one bend measured twice is one buoy. EVERY ONE OF THEM FLASHES, and no two of them alike. A buoy carries a light CHARACTER the way a chart quotes one — `light.flashes` of them in a group, one group every `light.period` seconds, each buoy on its own phase — and `buoyLightAt` is that character as a pure function of the level's clock, so the lamp is never stepped, never stored and replays exactly. What the light is FOR is the dark: a lap ridden at dusk, at dawn or under the moon is read off the buoys, and a rounding mark nobody can see at night is a rounding mark that is not there.

## What swims here

R20's roster is the one piece of level content that is drawn from a CATALOG rather than from the rule book: `engine/game/defs/fauna.ts` states each animal — how long it is, how fast, how deep it holds, how many travel together, how often it comes up (`breath` for a cetacean, `bask` for the porbeagle) and how deep it holds when it does (`awash`, in body radii), whether its bulls breach (`breach`), and the water temperature it is met in — and, above all, `perKm`, how many pods of it a kilometre of coast carries. That last number spans three orders of magnitude, and it is the whole design: a coast where every animal turned up every ride would have no animals on it, only scenery.

`rarityOf(perKm)` turns the number into the word, so the two can never disagree. On the taiga coast, over a couple of kilometres of shore:

| Animal               | Pods per km | Rarity    | Travels in | Roughly            |
| -------------------- | ----------- | --------- | ---------- | ------------------ |
| Baltic herring       | 3.4         | common    | 14–30      | six schools a ride |
| Roach                | 2.2         | common    | 8–20       | four schools       |
| Perch                | 1.7         | common    | 5–12       | three schools      |
| Pike                 | 0.55        | uncommon  | 1          | one most rides     |
| Sea trout            | 0.42        | uncommon  | 2–5        | one most rides     |
| White-beaked dolphin | 0.4         | uncommon  | 3–8        | one ride in two    |
| Harbour porpoise     | 0.16        | scarce    | 1–3        | one ride in three  |
| Porbeagle            | 0.04        | rare      | 1–2        | one ride in twelve |
| Killer whale         | 0.02        | legendary | 2–5        | one ride in forty  |
| Minke whale          | 0.011       | legendary | 1–2        | one ride in sixty  |

The five fish and the porpoise are the Bothnian Sea's own. The porbeagle, the orca and the minke are Atlantic animals that stray into the Baltic a handful of times a century; they are in the catalog because the game wants them, and they are as rare as it can make them and still be reachable. The white-beaked dolphin is the exception, and its rarity is set by what it DOES rather than by where it belongs: its bulls breach, and a leap nobody is ever there to see is not a feature.

Coming up is the sighting, and the sighting is a FIN. A fish never comes up; a cetacean surfaces to breathe and the porbeagle comes up to hunt and bask, and either way the animal rises until its centreline is `awash` body radii under the water over it — about one, which brings the back awash and leaves the dorsal, and only the dorsal, cutting the surface. Measured against that water and not against mean sea level, because a sea a metre high swallows a fin that clears the mathematical plane by a hand's breadth.

One animal goes further. A BULL DOLPHIN breaches roughly every `breach` seconds: a ballistic arc that takes the whole animal three quarters of its own length clear of the sea and is the only time this game shows an animal against the sky. Only the dolphin, and only its males (`isMale`), so a pod of five throws one every twenty seconds or so and a rider who passes one sees it once or twice.

`make level SEED=n` prints the roster a seed drew, and `make analyze` counts the pods and the animals per level.

## The numbers

Every band above is a row of `LEVEL_RULES`; these are the ones a tuner reaches for first, with their units. The file is the authority — a number here that disagrees with it is a documentation bug.

| Group     | Knob                          | Value                   | Unit   | Rule    |
| --------- | ----------------------------- | ----------------------- | ------ | ------- |
| `grid`    | `cell`                        | 4                       | m      | R14     |
| `bounds`  | `sea` / `land`                | 150 / 130               | m      | R14     |
| `route`   | `length` / `step`             | 1500–2300 / 10          | m      | R24     |
|           | `corridor`                    | 34–95                   | m      | R15     |
|           | `swing` / `reach`             | 0.45–0.95 / 520         | —, m   | R24     |
|           | `selfClear` / `selfSpan`      | 85 / 220                | m      | R24     |
| `leg`     | `at` / `out` / `round`        | 280–900 / 20–90 / 58–76 | m      | R25     |
|           | `offshore` (derived, checked) | 130–360                 | m      | R25     |
|           | `span` (of path, checked)     | 200–620                 | m      | R25     |
| `river`   | `inland` / `length`           | 1000–1250 / 1000–2600   | m      | R26     |
|           | `head` / `taper`              | 3 / 1.8                 | m, —   | R26     |
|           | `sinuosity` (checked)         | 1.12–2.7                | ×      | R26     |
|           | `clear` / `radius`            | 100 / 38                | m      | R26     |
| `island`  | `count` / `r` / `clear`       | 1–4 / 25–95 / 18        | —, m   | R15     |
| `circuit` | `offshore`                    | 230–430                 | m      | R29     |
|           | `lap` / `laps`                | 640–1150 / 2–3          | m, —   | R30     |
|           | `length` (the whole ride)     | 1400–2900               | m      | R30     |
|           | `harmonics` / `harmonic`      | 2–3 of 2–5              | —      | R29     |
|           | `swing` / `turn` (checked)    | 0.05–0.15 / 7.2–16      | —, rad | R29     |
|           | `selfClear` / `selfSpan`      | 85 / 200                | m      | R29     |
|           | `airPerLap`                   | 1                       | —      | R30     |
|           | `mark.count` / `.stand`       | 2–4 / 42–125            | —, m   | R31     |
|           | `mark.wrap` / `.apart`        | 1.5 / 150               | rad, m | R31     |
|           | `coast.run` / `.wander`       | 360 / 45 over 280       | m      | R29     |
|           | `rocks.offshore`              | 60–1200                 | m      | R29     |
| `shore`   | `character.run`               | 1100                    | m      | R21     |
| `land`    | `maxHeight` / `reach`         | 45 / 100                | m      | R2      |
|           | `plateau`                     | 8–20                    | m      | R2      |
|           | `slab.amplitude`              | 1.6                     | m      | R2      |
|           | `hill` (× the plateau)        | 0.45–2                  | —      | R2, R21 |
| `sea`     | `depth` / `reach`             | 25 / 250                | m      | R3      |
| `sea`     | `openDepth` / `openReach`     | 60 / 700                | m      | R3      |
|           | `shelf.factor`                | 0.55                    | —      | R3      |
| `course`  | `offshore`                    | 15–100                  | m      | R1      |
|           | `aim`                         | 25–90                   | m      | R1      |
|           | `minDepth`                    | 1.5                     | m      | R5      |
|           | `solidMargin` / `solidBerth`  | 6 + 0.8 × radius        | m      | R6      |
|           | `length`                      | 1200–2000               | m      | R10     |
|           | `wind` / `sweep`              | 1.06 / 3.5              | ×, rad | R22     |
|           | `radius`                      | 55                      | m      | R23     |
| `gate`    | `spacing` / `width`           | 80–150 / 12             | m      | R4      |
| `air`     | `count` / `height` / `width`  | 2–3 / 2.5–5.5 / 6       | —, m   | R7      |
|           | `lipSpeed`                    | 50–60                   | km/h   | R18     |
|           | `pastApex` / `thread`         | 1.7 / 0.8               | —, m   | R18     |
|           | `reach`                       | 0.95 of slowest         | —      | R18     |
| `ramp`    | `lead` (derived, checked)     | 12–32                   | m      | R8      |
|           | `length` (plan) / `width`     | 8–10 / 4                | m      | R8      |
|           | `angle`                       | 15–22                   | °      | R8      |
|           | `runUp` / `runUpDepth`        | 160 / 2                 | m      | R9      |
|           | `beam`                        | 30                      | °      | R9      |
| `start`   | `behind`                      | 40                      | m      | R11     |
| `wind`    | `speed` / `seaward`           | 6–14 / ±60              | m/s,°  | R12     |
| `day`     | `minSun` (the window's floor) | 0                       | °      | R13     |
| `sky`     | `spread`                      | 0.32                    | —      | R19     |
| `solids`  | `<kind>.perKm`                | 5 / 14 / 7 / 12 / 2.5   | /km    | R17     |
|           | `erratic.height`              | 1.2–4 over ground       | m      | R17     |
|           | `stack.r` / `.top`            | 6–15 / 7–22             | m      | R17     |
|           | `mark.r` / `.top`             | 8–14 / 21–32            | m      | R25     |
| `land`    | `measured`                    | 116                     | m      | R2      |
| `search`  | `attempts` / `courseTries`    | 24 / 40                 | —      |         |
|           | `depthSlack` / `marginSlack`  | 0.4 / 1.5               | m      |         |

The `search` group is the search's own: how many sub-seeds it tries, and the SLACK it builds in over the rules so that the analysis — which reads the baked, bilinear grid rather than the analytic field the search reads — finds the finished level inside the bands.

## The search

1. **The route (R24, R25).** `drawRoute` walks the racing line in the empty plane: a step every 10 m, turning on a smooth noise inside the tightest circle R23 allows, bent back toward the middle when it strays past `route.reach`, steering away from the legs it has already ridden. Which side the OPEN SEA lies on is drawn with it, and the walk's own most seaward station is where the OCEAN LEG is spliced in — a quarter turn out to sea, a run of `leg.out`, a half circle round the MARK, the run back and the turn that puts the line on the heading it left on. Past the leg the walk is held inshore of that station (a level goes out to the ocean once), and a line that folds back inside `route.selfClear`, or whose furthest point falls where the course could not reach it, is redrawn.
2. **The river (R26).** `drawRiver` continues the water inland from the most inland station the RACE goes past — a station rather than an end, so the mouth is a bend the rider can turn up mid-run and not a reach behind the finish gate. It meanders under its own curvature bound, pulled toward the way inland lies, until its head stands `river.inland` from the mouth, and its half-width tapers from the corridor's to `river.head`. A walk that wanders back onto the racing line is redrawn.
3. **The water (R15).** `layBasin` stamps both lines — the route's corridor and the river — into ONE signed offshore field, cuts the open sea past a straight edge `sea.line.edge` short of the route's most seaward station OUTSIDE the leg, and cuts the islands back out of both, keeping them off the leg and off the river. The coastlines are wherever the field crosses zero (`traceCoast`), and there is more than one of them: the mainland, and one round every island.
4. **The ground (R2, R3, R21).** `createGeology` draws the height the land climbs to and its noise seeds, and the ground is baked from the offshore field alone: seaward, the concave bed profile (steep at first, level by 250 m, on down to the open sea's depth), scaled shallower where the sediment collects; landward, a smooth step to the HILL this stretch of coast carries with the slabs riding on it. Past `land.measured` inland the field stops measuring and the ground is that hill.
5. **The leg's reach (R25).** The furthest point of the ocean leg is read off the field the moment there is one: a leg that came out inside R1's band is a bulge, not a run to a mark, and the attempt is rejected here rather than after a course has been laid in it.
6. **The conditions (R12, R13).** Wind from the open sea's own normal ± 60°, at 6–14 m/s; an hour from the coast's own DAYLIGHT window, so a seed is a sunrise, a noon or a sun going down and never a night; a water temperature from the biome's band.
7. **The course (R1, R4–R11).** `layCourse` measures the gates out along the route by distance — gate 1 at 40 m, then a spacing drawn from 80–150 m until the next would pass the target, with the finish pushed past the ocean leg — straightens the start, and lifts two or three gates into the air: a ramp length and angle drawn, `ringPlacement` deriving the ring from the design arc (R18), the window checked as a chord for depth, for the band and for the BEAM (R9, on the chord the window is about to become), and the path inside it replaced by that chord. The basin is the expensive artefact, so a draw that cannot fit its jumps is re-shuffled `search.courseTries` times before the basin is given up.
8. **The rocks (R17, R25).** The MARK first, where the route put it. Then sea stacks, skerries, boulders, reefs and the erratics on the shore itself, each at its density inside its offshore band, required to stand proud of the bed, kept off the path, the buoys and the air corridors by the berth its own radius earns (R6), and kept apart from each other and from the mark. Scattered over the ROUTE'S box rather than the level's, so the river's kilometre of country does not thin the coast the race is ridden along.
9. **The sky and the sea life (R19, R20).** Last of the draws, and deliberately so: no sky and no school makes a basin unrideable, so neither has any business moving the route, the course or the rocks the draws before them made.

### …or the circuit's own three steps (R29–R31)

A level asked for as a CIRCUIT replaces steps 1–3, 5 and 7 above and skips
step 2 entirely; everything else — the ground, the conditions, the rocks,
the sky, the sea life, the bake and the gate — is the same code in the same
order, because none of it has an opinion about which kind of race is laid.

1. **The loop (R29, R31).** `drawCircuit` draws a CLOSED curve rather than a
   walk, and it draws it in the SEA'S OWN FRAME — `u` seaward, `v` along the
   coast — so the shape can be aimed at the shore rather than merely placed
   near it. The radius is polar, `r(θ) = 1 + bulge·cos θ + Σ aₖ·sin(kθ + φₖ)`
   with θ = 0 pointing out to sea: the bulge is a first harmonic locked to
   that heading, which makes the shape a teardrop with its flat side against
   the beach and its nose out in the ocean, and the `v` axis is stretched by
   `circuit.stretch`, which turns the point where a round lap would touch the
   shore into a RUN along it. The unit shape is scaled to the lap length the
   level drew — its perimeter scales with the mean radius — and refused where
   the loop does not reach far enough out (`reach`), where too little or too
   much of it tracks the coast (`ashore`), where a corner comes out under
   R23's radius, where it comes back inside `circuit.selfClear` of itself, or
   where it turns no further than a circle does. The line is then resampled
   by arc length into a whole number of steps that closes on its own first
   point, starting at the flattest station of the SHORE LEG, because that is
   where the start line goes. Every bend that turns far enough carries a lit
   BUOY at the centre of its turn — at least one of them out past
   `circuit.mark.ocean` — verified with `roundingAbout`, the analysis's own
   instrument.
2. **The ocean (R29, R15).** `oceanEdge` cuts the open sea's edge back from
   the loop's most inshore station by exactly `circuit.inshore`, measured
   against the WAVY edge station by station rather than against the mean one
   (a promise made against the mean is a promise a bay breaks); `circuitBounds`
   squares off a box holding the loop, the sea outside it and the strip of
   coast on one side; and `layOceanBasin` fills the offshore field with one
   expression per cell, `coastWander` being the same function both of them
   read. No corridor is stamped and no island is cut: the sea's own half-plane
   already carries every metre of the lap, and the things it goes round are
   SOLIDS.
3. **The lapped course (R30).** `layCircuitCourse` measures the gates out
   once round at a spacing that DIVIDES the lap, lifts exactly one of them
   into the air with the same window machinery a sprint uses, re-measures the
   lap the straightening left, and re-asks R29's turn and R31's roundings of
   the lap THAT SHIPS rather than of the loop it was handed. The start is a
   straight stub tangent to the line rather than a stretch of the loop cut
   straight, because that stretch is ridden on every lap. What it publishes
   is the whole ride: the lap's gates repeated `laps` times with one more
   crossing of the start line, which is the finish.

4. **The bake and the gate (R14, R16).** `compileLevel` closes the surface classifier over the two grids, traces the coastlines and assembles the level; `analyzeLevel` re-checks all of it. Clean, and the level ships; not, and the attempt is rejected with its findings in the log, and the next sub-seed goes round again.

Every draw comes off one seeded stream in a fixed order, so the same seed always produces the same level, and the same seed in two different processes agrees to the bit.

## The ramp's anchor

Stated once, in `course.ts`, for everything that reads a `Ramp`: `(x, z)` is the HINGE — the centre of the rear edge, floating at the waterline. The deck runs `length` metres ALONG THE WATER from it in the direction `heading` — `length` is the plan footprint — rising at `angle`, so the lip stands `length · tan(angle)` above the sea. `rampSurface(ramp, x, z)` returns the deck's height at a plan point or `null` beside it, and the collision engine's `rampDeckY` is the same line.

## The ring's place (R18)

A ring is not drawn at a height; it is put where a hull will BE. `ringPlacement(length, angle)` draws two ballistic arcs off the lip under the engine's `g`: the slow one for the catalog's lowest-riding hull at the design band's floor (50 km/h), the fast one for the highest-riding hull at its ceiling (60 km/h). The ring's centre sits at their mean, `air.pastApex` apex-distances past the lip — on the way down, so the hull is through the ring before it is looking at the water — and the two arcs' spread must fit inside the ring's radius less `air.thread`. The search, the analysis and the tests all call the same function, so none of them can put a ring somewhere the others would not. The analysis then asks the bot's own `launchSpeedFor` what hinge speed every catalog craft needs for the ring as built, and fails the level if any of them is above `air.reach` of the slowest craft's top speed or outside the design band.

## Determinism and the corpus

A level is a pure function of its seed and its options. The tests hold that first (`tests/mapgen_test.ts`: two builds of a seed are deep-equal, and the classifier answers the same everywhere), and everything else in the suite depends on it: `tests/support/levels.ts` builds each corpus seed ONCE and hands the same read-only level to every rule's `it`, because a second build could only return the first one's answer and building one is the most expensive thing the engine does.

## Looking at the output

- `make level SEED=38` draws one level: depth shading, the shore, every solid by id, the gates numbered, the ramps, the river from its mouth to its head, the wind arrow, and a listing of every gate with its offshore distance and depth.
- `make analyze SEED=38` prints the analysis — every finding with its rule, and the stats worth reading when nothing is wrong.
- `tests/mapgen_population_test.ts` reads the generator as a POPULATION: gate counts, air gates, lengths, winds and build times over thirty seeds, held to bands that are inside the rule book's and wide enough to show the seed is choosing. A rules change moves a distribution, and that file is where the movement shows.

## Extending the vocabulary

A new rule takes the next R-number in `rules.ts`'s header, its numbers in `LEVEL_RULES` with their units, its enforcement in the search or the compiler, its re-check in `engine/analysis/index.ts`, an `it` in `tests/mapgen_test.ts`, and its verbatim line in this file — the same day. A rule that lives in fewer than all six places is a rule that will drift.
