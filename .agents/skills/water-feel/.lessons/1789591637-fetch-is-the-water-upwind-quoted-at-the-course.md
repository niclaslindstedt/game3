---
title: Fetch is the water UPWIND, measured by one grid sweep per fan ray — and the sea's one period is quoted at the COURSE's fetch, never at the level's furthest cell
date: 2026-09-09
scope: engine/game/water.ts, engine/game/fetch.ts, engine/game/defs/tuning.ts
concepts: [fetch, period, spectrum, feel, exposure, shelter]
---

Reading fetch as `level.offshore` is wrong both ways: under R12's onshore
wind, water a few metres off a beach has the whole ocean upwind and earns
the full sea, while a river ten metres wide sat at `baseFetch` with two
thirds of the coast's. Measure what the wind CROSSED — SPM (1984)'s
effective fetch over a cos-weighted fan upwind — and do not march a ray per
point: ONE SWEEP per fan ray over the grid, each cell reading its two
upwind neighbours mixed by the direction cosines, is first-order upwind at
O(cells) a direction (+6 ms on a 400 ms build for five rays). Land zeroing
the run IS the model — shelter behind a headland and up a channel fall out
of that line, and the lateral half of the scheme softens like diffraction
for free. It is right for the fetch and wrong for a PHASE (the eikonal
lesson). Two traps: the fan's width barely matters (±45° and ±90° both leave
26 % of gates in near-flat water, because what shelters water here is land
enclosing it), and bilinear sampling near a beach mixes the water's cell
with the land's — grow the field two cells into the land afterwards, or the
sea fades out exactly where the wind drives it hardest.

`createSea` then carries ONE peak period per band for the whole level, and
WHERE it is quoted decides how the sea feels under the gates. Quoted at the
furthest offshore cell (a kilometre out) it read 7 s — a 68 m roller — on
gates whose own fetch earns 4.5 s and 30 m; the hull crossed a crest every
two seconds instead of every one. `overCourse` (the mean effective fetch
over the gates) is the reference. Hs barely cares (∝ √F); the period
(∝ F^⅓), and so the wavelength and the encounter rhythm, are what move.
`make waves` prints the reference fetch in its header: a hundred kilometres
on a level whose gates stand a hundred metres off the shore is the wrong
quote.
