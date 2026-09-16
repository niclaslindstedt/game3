---
title: A biome that opens the river's mouth wider than the corridor is capped by R1 — the mouth station is ON the path, so the mouth's half-width can never pass `course.offshore.max`
date: 2026-09-16
scope: engine/mapgen/river.ts, engine/mapgen/biomes.ts
concepts: [river, biome, offshore, r1, bands]
---

`Biome.river.mouth` multiplies the corridor's half-width at the mouth, and
the mouth is the route's most inland station — a point of the racing line.
The basin stamps the river's owed width there, so the path reads `offshore`
equal to the mouth's half-width, and a multiple that takes it past R1's
ceiling (100 m) fails every seed at R1 with nothing else wrong. The cap is
in `drawRiver`: `min(corridor × mouth, course.offshore.max −
search.offshoreSlack)`, so the knob opens a narrow mouth and does nothing to
one already at the corridor's ceiling. The same trap waits for any biome
multiplier on a width the racing line is measured against — check which
band the path reads before multiplying it.
