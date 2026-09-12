---
title: A phase integrated along one heading carries every shoal's delay downwind forever — solve the eikonal, feed it the deep plane wave at the rim, and measure |∇φ|/k over the corpus
date: 2026-09-10
scope: engine/game/water.ts, engine/lib/heightfield.ts
concepts: [phase, refraction, diffraction, eikonal, river, renderer]
---

Why, in one line: `∫k(d)·ds` along a fixed heading leaves an OFFSET between
neighbouring paths that nothing downstream relaxes, and its lateral gradient
is a wavenumber the wave never had — over ten seeds a fifth of the exposed
water read three to seven times too short, crawling sideways, in every lee
and either side of every river mouth. SKILL.md carries the rule; these are
the traps in obeying it.

Fast sweeping settles a generated level in two rounds to a thousandth of a
radian of eight, at ~25 ms a component. Refraction and the wrap into a river
mouth come free; the CREASE where two arrivals meet in a lee does not — a
kink a cell or two wide, at an exposure of a few tenths.

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
