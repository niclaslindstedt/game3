---
title: The far water is a coarse grid summing only the LONGEST components off the same surfaceAt, with a hole under the near grid and a sink sized to the chop it leaves out
date: 2026-09-09
scope: pwa/src/game/water-mesh.ts, engine/game/water.ts
concepts: [renderer, water-mesh, swell, storm]
---

A storm swell (λ of hundreds of metres) cannot be drawn by a 240 m near grid that fades to flat: the fade cuts a ten-metre wave off at the edge. `surfaceAt`'s `count` sums the first N components — the longest, since the band is laid low to high — so the far grid (40×40 over ±640 m) draws the swell its 33 m cells can carry and none of the chop that would alias on them; in an ordinary wind sea no component qualifies and the far grid costs nothing. Two traps found the hard way: (1) a far grid drawn UNDER the near grid stands up through it wherever the short components sum to a trough and hides the hull entirely — so the far index buffer has a hole under the near grid's interior and the whole far grid is sunk by `FAR_SINK + SHORT_SINK × Σ(short amplitudes)`; (2) the near grid's edge must fade to the far grid's (sunk) height, read bilinearly off its displaced positions, not to zero, or the seam is a lip the height of the swell. Screenshot the storm (`--hs 20`) at `chop` after touching any of it: the hull must be in the frame.
