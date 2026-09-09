---
title: A submerged body is made visible by hazing IT toward the bright shallow sea colour, never by making the surface's alpha lower
date: 2026-09-09
scope: pwa/src/game/fauna.ts, pwa/src/game/water-mesh.ts
concepts: [fauna, water, transparency, shaders]
---

The water surface's alpha is one number for a patch of sea and knows nothing
about how far under it a thing is, so tuning it to reveal a whale at 7 m
also reveals the sea bed at 25 m and the sea stops looking like water. Two
rounds were spent lowering `CLEAR_ALPHA`/`DEEP_ALPHA` with no visible gain,
because over deep water the terrain behind the animal is near-black and a
dark-backed animal at 30% opacity over near-black is invisible whatever the
alpha says.

What worked was moving the depth cue onto the ANIMAL: a mix toward
`PALETTE.seaShallow` (the BRIGHT tone — the light scattered back out of the
column, not the deep tone) by its own world `y`, grafted into the vertex
shader beside the tail beat. A deep animal becomes a pale ghost against
dark water and a surfacing one is crisp and dark, which is both the correct
physics and the whole depth cue.

The second half of the same fix is the countershading: the back/belly split
sits at `t ** 2.4` rather than a smoothstep, so the pale flank runs most of
the way up the body. Honest countershading over dark water is an animal
nobody can pick out.
