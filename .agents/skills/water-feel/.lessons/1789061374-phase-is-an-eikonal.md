---
title: A phase integrated along one heading carries every shoal's delay downwind forever — solve the eikonal, feed it the deep plane wave at the rim, and measure |∇φ|/k over the corpus
date: 2026-09-10
scope: engine/game/water.ts, engine/lib/heightfield.ts
concepts: [phase, refraction, diffraction, eikonal, river, renderer]
---

`∫k(d)·ds` along a component's fixed heading is not a phase field. Every
cell one path crosses at a different depth from its neighbour's leaves an
OFFSET between the two that nothing downstream relaxes, and the offset's
lateral gradient is a wavenumber the wave never had. Over ten seeds a fifth
of the exposed water carried an ocean band three to seven times too short,
heading 70° sideways, crawling — in the lee of every reef and either side of
every river mouth, where a course's first gates stand. Land (integrated at
`minDepth`'s k, seven times the deep rate) was the worst case, and fixing it
alone left the bad share unchanged: the offsets came from 300 m upwind.

The phase is the EIKONAL |∇φ| = k(d). Fast sweeping (Godunov's update in the
four sweep orders) settles every generated level in two rounds to a
thousandth of a radian of eight, at ~25 ms a component. Refraction (Snell's
law, exactly) and the front wrapping into a river mouth as arcs about the
corner fall out for free; the amplitude stays the exposure's. What it cannot
do is heal the CREASE where two arrivals meet in a lee — a kink a cell or two
wide where the gradient collapses, at an exposure of a few tenths.

Three traps:

- **Feed the rim the DEEP-WATER plane wave, only on the sides the wave comes
  in over.** A plane at each rim cell's own k(d) scales the ABSOLUTE phase,
  not the rate: a shallow rim cell radiates hundreds of radians early and
  the min carries it across the level (turned share 5% → 80%). A rim the
  wave leaves by reads nothing. Generated rims are 28–35 m deep; the
  synthetic 8 m bed refracts AT the rim by Snell — physics, not a bug — so
  test refraction on `depth: 40`.
- **The wave vector is the field's gradient, read in the same bilinear
  sample as the phase.** A slope built from `k·d̂` disagrees with the height
  the moment a crest turns.
- **The check is one sweep of the corpus**: |∇φ| / k(d) per component over
  every exposed cell deeper than 3 m on ten seeds, and at every gate. The
  heading column is a defect before the fix and refraction after it.
