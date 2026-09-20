---
title: Judge a change to the sea's CPU by the COUNT of `surfaceAt` calls, or by an A/B interleaved in one process — wall-clock in this container drifts further than the win
date: 2026-09-20
scope: pwa/src/game/water-mesh.ts, pwa/src/game/water-grid.ts, engine/game/water.ts
concepts: [water-mesh, performance, measurement, profile, surface-at]
---

A pure-Node harness that lays the design-point grid and times `surfaceAt` over
every vertex reads about 4 ms a frame — and re-reads 3.89, 4.17 and 4.22 ms on
three consecutive runs of the same code, drifting upward as the container
warms. A 20 % win is invisible in that, and a change that made things FASTER
measured slower. Two ways to get an answer that holds:

- **Count, do not time.** A cull or a grid change moves the number of
  `surfaceAt` calls, which is exact, deterministic and hardware-free. Build a
  `THREE.Frustum` from a chase-like lens, walk `layWaterGrid`'s vertices, and
  print how many survive under the old rule and the new one side by side. That
  is what showed the per-vertex cull margin was worth 30 % of the grid at the
  design point and 40 % at the top distance stop.
- **Interleave the A/B in ONE process.** Where the change is arithmetic rather
  than a count, write both versions into one script and run them alternately,
  min-of-N each. The container's noise then hits both equally. That is how the
  depth-table hoist in `surfaceAt` came back as a solid 38 % off that term,
  where the full-loop timing had called it a regression.

`make profile`'s `cpu ms` and `fps` columns are SwiftShader and are not this
measurement at all; its `draws` and `tris` are the honest, hardware-free
numbers, and they say nothing about the grid, which is CPU.
