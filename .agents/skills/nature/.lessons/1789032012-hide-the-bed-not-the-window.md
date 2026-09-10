---
title: Hide the sea bed by fading the BED into a flat unlit tone, never by raising the surface's alpha — and the tone it fades into must be dark, not the water's own
date: 2026-09-10
scope: pwa/src/game/terrain.ts, pwa/src/game/water-optics.ts, pwa/src/game/water-mesh.ts
concepts: [water, transparency, terrain, water-mesh, see-through, colour]
---

"Less transparent, but keep the sea life" cannot be bought with the surface's
window: whatever the surface keeps for itself it keeps from the animals under
it too, and at a deep stop of 0.76 a pair of porpoises eight metres down goes
from faint to one of them gone (`--scene wildlife --seed 19`, the two builds
side by side). 0.68 is the last stop that still reads on the taiga.

What actually retires the bottom is fading the BED over the coast's `clarity`,
because that rides ITS depth rather than the surface's. Two things about the
tone it fades into, and the second cost a round:

- It must be FLAT. What gives a hidden bottom away is not brightness but
  SHAPE — the contours the light picks out, the pale sand patches, the
  per-vertex speckle. Fade the speckle and the slope shading out with it and
  there is nothing left to read.
- It must be DARK — a coast's own unlit bottom tone (`WaterOptics.bed`), NOT
  the water's colour at that depth. Fading the bed into the bright water tone
  looks like the physically tidy answer (the two then meet with no seam) and
  hands back a pale, milky sea: most of the open sea's tone was the dark
  bottom showing through the window, and removing the darkness removes the
  day. This is the same trap as `CLOSED_BED` in `water-mesh.ts`, arrived at
  from the other side.

Once the bed is flat and dark, the fish READ BETTER than before at the same
window, because their background stopped being mottled bed contours.
