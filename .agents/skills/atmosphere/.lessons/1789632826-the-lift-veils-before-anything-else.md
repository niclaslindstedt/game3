---
title: On a whole-frame grade the LIFT goes wrong before any other dial, and no number in the table says so — a doubled lift veils the tree line and still measures like a cold picture
date: 2026-09-17
scope: pwa/src/game/colour-grade.ts
concepts: [colour, grade, screenshots, tuning, verification, biome]
---

Grading the cold coast, `lift: 0.045` measured exactly as intended — the
frame's R−B flipped warm to cool at every level of the ramp, mid grey held
its exposure to within 6%, the monotonic case passed. On the shot (seed 38 at
dusk, `--scene coast --biome taiga`) it was a fogged picture, not a cold one:
the darkest fifth of the frame had come up 43%, and the tree line no longer
read against the sky at all. `0.022` is the same coast and none of the veil.

The lesson is the instrument, not the number. A cast, a saturation and a
contrast all announce themselves in an R−B or a luma reading of a frame; a
lift announces itself as *slightly brighter*, which is indistinguishable in
the numbers from a sky one notch lighter, and its actual cost is SEPARATION —
the far shore against the air behind it — which nothing in a mean measures.

So: tune a lift on a shot with a silhouette in it, and shoot the coast's own
worst case for it, which is the low-contrast one (dusk, or overcast). Pair the
two per coast (`--weather clear` and `--weather overcast`) rather than one
bright frame; a grade that is right at noon can be a veil at dusk, and the
frame-mean comparison will say both are fine. The numeric pass is still worth
running — it is what catches an exposure that has quietly moved — but it
cannot see the failure this dial actually has.
