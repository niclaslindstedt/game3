---
title: A submerged body is made visible by hazing IT toward the bright shallow sea colour and by lifting its pale flank — and both must slide back off as it breaks the surface
date: 2026-09-09
scope: pwa/src/game/fauna.ts, pwa/src/game/water-mesh.ts
concepts: [fauna, water, transparency, shaders]
---

The water surface's alpha is one number for a patch of sea and knows
nothing about how far under it a thing is, so tuning it to reveal a whale
at 7 m also reveals the sea bed at 25 m. Two rounds were spent lowering
`CLEAR_ALPHA`/`DEEP_ALPHA` for no visible gain, because over deep water
the terrain behind the animal is near-black and a dark-backed animal at
30% opacity over near-black is invisible whatever the alpha says.

What works is putting the whole cue on the ANIMAL, in the vertex shader
beside the tail beat, and driving both halves of it off `aWater − worldY`
— the depth under the pod's own sea level, handed in per instance:

- **The haze**: a mix toward `PALETTE.seaShallow` (the BRIGHT tone — light
  scattered back out of the column, not the deep tone), so a deep animal
  is a pale ghost and a surfacing one is crisp.
- **The countershading**: the body is painted TWICE and mixed by the same
  depth. `SHADE_DEEP` (2.4) runs the pale flank most of the way up, which
  is the only way to pick a body out of dark water; `SHADE_WET` (0.7) is
  the animal as it really is. Slide to WET within about a body's depth of
  the surface — above the water the background is bright sea and sky, and
  a killer whale had better be black there.

Getting this wrong is not subtle in one direction only: honest
countershading over deep water is an animal nobody can see, and lifted
countershading on a fin standing in daylight is a white orca.
