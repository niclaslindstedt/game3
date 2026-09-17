---
title: A coast that comes down as a wall must do so on its RUGGED stretches only — a steep climb applied everywhere turns the whole waterline to bedrock and R21 refuses every seed
date: 2026-09-17
scope: engine/mapgen/biomes.ts, engine/mapgen/geology.ts, engine/mapgen/compile.ts
concepts: [biome, shore, r21, climb, relief, generator, classifier]
---

The classifier's FIRST test is the slope (`surface.bedrockSlope` = 0.22), before
the beach and the boulder field get a say. So a biome row that shortens the
climb (`climb` under 1) or raises the plateau (`relief` over 1) is really a row
about the waterline's MATERIAL: at `climb 0.12` and `relief 2.25` applied to
every stretch, even the softest bays climbed at over 0.3 m/m, every metre of
waterline was "bedrock", and R21's quilt rejected all sixteen arctic seeds.

What works is to make the wall a property of the CHARACTER (R21): `geology.ts`
applies the shortened reach over the top of the ruggedness only (`WALL_FROM`,
smoothed), so the soft and the middling stretches keep the rule book's own
slopes — and their gravel and their boulder fields — and only the headlands
stand up as a wall. With that, `relief 1.8 / climb 0.06` builds 16/16 and the
walls measure 1.2–2.5 m/m over the corpus against the taiga's 0.5–1.4.

Two related traps from the same pass: a river's mouth multiple under 1 pinches
the race's own water and the course draw fails ("the basin cannot carry a
course"), and a `head` multiple under 1 puts the creek under the grid's cell so
R26 reports the river running out of water. Keep both at 1 and shape the river
with `taper` and `bend`. And a coast whose river has sheer walls fails R26's
bank share by construction — that is what `RiverShape.banks: false` is for.
