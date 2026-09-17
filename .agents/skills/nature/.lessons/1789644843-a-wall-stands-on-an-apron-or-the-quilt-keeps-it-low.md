---
title: A coast that comes down as a WALL has to stand it on an APRON — a wall whose foot is the waterline cell is bedrock from foot to lip, and R21's quilt then keeps the wall off two stretches in three, which puts it off the course
date: 2026-09-17
scope: engine/mapgen/biomes.ts, engine/mapgen/geology.ts, engine/mapgen/compile.ts, engine/mapgen/river.ts
concepts: [biome, shore, r21, r2, climb, apron, generator, classifier, river]
---

The classifier's FIRST test is the slope (`surface.bedrockSlope` = 0.22), before
the beach and the boulder field get a say. So a wall whose climb begins AT the
waterline is "bedrock" from its foot up, and R21's quilt (1100 m of one
material at most) then has to be paid for by the coast going LOW somewhere
else. The first arctic paid for it by confining the wall to the top of the
character (`wall.from` 0.35, all of it at 1): 16/16 built, and the wall stood
on the far bank of the river's head and on the ocean side of the headland —
anywhere but beside the course. Measured beside the line (the test now does),
the shore topped out at 10–27 m on most seeds while the fronts elsewhere
reached 64. Raising the ceiling and the headland factor changed none of that:
it made the RARE wall taller.

What works is the APRON (`Biome.wall.apron`): the wall climbs from `apron` m
behind the waterline, on a foot of rubble a metre and a half up, so the
waterline in front of a wall reads off ITS slope — a boulder field, or sand on
the softest stretch — and the quilt is the field's to break rather than the
slope's. With that, the wall can be the coast's ORDINARY shore (`wall.from`
0.25, whole by 0.5) and 16/16 still build, with 40–65 m of front beside the
course on every corpus seed. The lift (`headland`) and the shortened reach
(`climb`) both ride the same ramp, and everything is branched at zero so the
taiga's ground is bit for bit what it was.

Two traps from the same pass that still hold: a river's mouth multiple under 1
pinches the race's own water and the course draw fails ("the basin cannot
carry a course"), and a `head` multiple under 1 puts the creek under the
grid's cell. Keep both at 1. A crack's PLAN is `RiverShape.kink` (bang-bang
turning: reaches and corners) and `ragged` (the width wandering) — both
branched at zero, and the ragged width clipped to R1's ceiling at the mouth.
