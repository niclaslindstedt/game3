---
title: A rejection placer must ask its cheapest, most-rejecting gate BEFORE it pays for the candidate, and `tries` is read against the narrowest band
date: 2026-09-16
scope: engine/mapgen/fauna.ts, engine/mapgen/rules.ts
concepts: [fauna, placement, generator, rarity, offshore]
---

`layFauna` drew ten values per attempt — the loop, the depth, the school,
the sense, the phase, the scatter — and only then tested the offshore band.
With `R.fauna.tries` at 10 that placed a humpback, whose band is about a
twentieth of a level's bounding box, **less than half the time it was
dealt**. The rarest animals in the game were being thinned by the placer
rather than by their own `perKm`, and nothing measured it: the counts look
plausible whatever the rejection rate, because rarity is what they are
supposed to show.

Two fixes, both needed:

- Draw the candidate POINT, test the band, and only then pay for the rest of
  the pod. A try becomes two draws and a field sample.
- Read `tries` against the NARROWEST band in the catalog, not a typical one.
  For a 6%-of-box band, 95% success needs ~51 tries; 60 is the number now.

Reordering also lifted the inshore rows, which had been losing tries too
(perch 1.10 → 1.63 pods a seed, snook 1.95 → 3.52) — a reminder that the tax
is paid by everything, just worst by the rare.

What makes this one hard to see is that the counts look plausible at any
rejection rate — so check a row against what it was OWED, not against a
feeling: `perKm × km × (the share of seeds its temperature band admits)`.
