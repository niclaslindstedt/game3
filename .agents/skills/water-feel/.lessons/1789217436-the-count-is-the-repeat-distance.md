---
title: The component count is the sea's REPEAT DISTANCE, its price is the phase field at build time, and raising it takes steepness OUT of the water
date: 2026-09-12
scope: engine/game/water.ts, engine/game/defs/sea.ts
concepts: [spectrum, steepness, tuning, performance, measurement, feel]
---

A sum of n components beats against itself after roughly n/2 of its own
wavelengths, because that is how far apart in frequency neighbouring
components have to sit to cover the band. At eight that is a couple of
hundred metres — inside the drawn sea — and calm water reads as corduroy.
Measure it as the biggest autocorrelation down the wind between 1.5 and 8
peak wavelengths over a patch of open water: 0.23 at eight, 0.21 at twelve,
0.14 at sixteen.

Two things about the price, and the obvious one is the wrong one:

- **Not the hot loop.** `surfaceAt` is ~220 ns of fixed work (the shares,
  the depth, the clip) and ~6 ns a component, so 8 → 16 is about +5 %. A
  benchmark that says otherwise is measuring an out-of-bounds `held`.
- **The build.** `createSea` sweeps an eikonal phase field per OCEAN
  component, ~20 ms each: 224 ms at eight against `generateLevel`'s 390 ms,
  348 ms at sixteen. That is the ceiling on this number, and it is paid on
  every run, every sim seed and every test level.

And the trap: **a coarsely sampled band is STEEPER than the spectrum it
claims to be.** Log-spaced slices are wide at the short end, so few
components carry too much energy at high k. Sampling finely took the rms
surface slope from 4.35 % to 3.97 % and a quarter off the air in a bot run,
with Hs unchanged to three figures — an accident that had been doing an
arcade dial's job. Put it back on the dial (`periodScale`, 1.0 → 0.95,
steepness goes as `heightScale / periodScale²`) and re-measure the slope,
not the picture.
