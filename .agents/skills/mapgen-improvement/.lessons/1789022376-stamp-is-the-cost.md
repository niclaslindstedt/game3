---
title: The basin's stamp is the biggest single cost in a level, and it grows with the SQUARE of how far it reaches — every new line drawn into the field pays it again
date: 2026-09-10
scope: engine/mapgen/basin.ts, engine/mapgen/rules.ts
concepts: [basin, performance, offshore, river]
---

`layBasin` stamps every sample of every line into the offshore field by
visiting each cell within `stampReach(width)` of it, so its cost is
(samples × reach²) and nothing else in a build comes close: measured with a
per-stage timer, basin 88 ms against ground 25, compile 16, analyze 22.
Adding R26's river — a second line as long as the route — doubled it.

Three things that helped, in order of how much:

- **Stamp each line TWICE**: a fine pass (5 m) reaching only past the water
  it is owed, and a coarse pass (20 m, a multiple of the fine one so the
  fine pass always wins where both land) for the country beyond. The
  overstatement a sampled line makes falls off with distance — 1.7 m one
  metre off the line, 0.02 m forty metres off — so the far field costs
  nothing to get right at a quarter of the samples.
- **`land.measured`** is what sets the reach, and every metre of it is
  squared. It cannot go under `land.reach` + three of R2's profile bins,
  or the analysis has nothing past the reach to read the profile's climb
  from.
- Bound each row by the CIRCLE rather than the box (a fifth of the cells
  in a square are outside the disc inscribed in it).

What is left on the table is the algorithm: this is a nearest-feature
transform done by brute force, and a Danielsson/8SSEDT sweep would be
O(cells) instead of O(samples × reach²). It would also rasterize the
samples to cells, which moves the coastline by up to half a cell — worth
measuring before trusting.
