---
title: Fetch is the water UPWIND, not the distance from the shore — and an upwind grid sweep is how you measure it for the price of one phase field
date: 2026-09-10
scope: engine/game/fetch.ts, engine/game/water.ts
concepts: [fetch, exposure, shelter, spectrum]
---

Reading fetch as `level.offshore` (metres from the water's edge) is wrong in
both directions at once: with the onshore wind R12 draws, water a few metres off
a beach has the whole ocean upwind of it and should carry the full sea, while a
river ten metres wide sits at `baseFetch` and gets two thirds of the coast's.
Measure what the wind actually CROSSED instead — SPM (1984)'s effective fetch
over a cos-weighted fan upwind.

Do not march a ray per point. One SWEEP per fan ray over the whole grid, each
cell reading its two upwind neighbours mixed by the direction cosines, is the
standard first-order upwind scheme at O(cells) per direction; five rays is a
fraction of what `createSea` spends on eight phase fields (measured: +6 ms on
a 400 ms level build). It is the right scheme for the FETCH — a run that land
resets — and the wrong one for a PHASE (see the eikonal lesson). Land zeroing a run is the whole
model — shelter behind a headland and up a channel falls out of that one line,
and the lateral half of the scheme gives a diffraction-like softening for free.

Two traps. **The fan's width barely matters**: ±45° and ±90° both leave 26% of
gates in near-flat water and a river at zero exposure, because what shelters
water here is that land encloses it. **Bilinear sampling near a beach mixes the
water's cell with the land's**, so grow the field two cells into the land
afterwards or the sea fades out exactly where the wind is driving it hardest —
which reads on a screenshot as the opposite of what the model is for.
