---
title: Every baked grid LIES at its edge — a clamped sampler repeats the rim forever, and a coarsened one can read zero there
date: 2026-09-11
scope: engine/game/water.ts, engine/game/fetch.ts, engine/game/ocean.ts, engine/lib/heightfield.ts
concepts: [heightfield, phase, fetch, shelter, offshore, renderer]
---

`sampleField` clamps to the edge cell, which is right for a probe a metre
past the shore and wrong for anything read a long way out. Three faults, all
the same fault, found in one session opening the seaward bound:

- **A clamped PHASE FIELD is a wave that stops travelling.**
  `sampleFieldGradient` returns a gradient of ZERO along an axis the sample
  is clamped in, and that gradient IS the wave vector — so the sea past the
  rim heaves in unison with no crest going anywhere. The fix is to carry the
  rim's phase on outward at the local rate along the component's heading,
  `φ(rim) + k·(d̂·o)`; it is continuous because the field was seeded at the
  rim with that same plane wave.
- **A clamped GROUND is a plateau.** Past the rim the last row repeats, so
  the seaward rim's thirty metres clips a twenty-metre sea to fifteen, and
  past a corner where the coast reached the box there is a hill of LAND
  standing out in the open ocean. `bedAt` (`ocean.ts`) is the single answer.
- **A COARSENED field can read literal zero at its edge.** `coarsen` in
  `fetch.ts` builds a grid whose last node OVERSHOOTS the fine one (the span
  rarely divides it evenly); its window fell entirely outside, averaged
  nothing, and stored 0. Read back bilinearly that zero reached inside the
  level — the wind died away to nothing over the last hundred metres of
  water every level holds, which is the water the ocean leg is ridden in.
  Clamp the window into the fine grid rather than skipping the outside half.

Before reading any field at a point a rider can now reach, ask what its edge
cell says and whether that is an answer or an artefact.
