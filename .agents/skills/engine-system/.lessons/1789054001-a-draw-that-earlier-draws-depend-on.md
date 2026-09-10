---
title: A late draw that EARLIER values depend on: draw the fractions early, resolve them late
date: 2026-09-10
scope: engine/mapgen/generate.ts
concepts: [determinism, mapgen, seeds, seasons]
---

R13's season had to be drawn at the END of the stream (the lesson beside
this one) — but the hour and the water temperature, drawn long before the
weather, depend on it: the daylight window and the water band are the
season's. Moving the season draw up moves every level; moving the two
draws down moves the course and the rocks.

The answer was to keep the two DRAWS exactly where they were, as plain
fractions (`rng.range(0, 1)` is the same single draw `inBand` made), and
turn them into an hour and a temperature only once the season is known.
Nothing before the weather draw sees a different number, so the shore,
the course, the rocks, the wind and the sky are the ones every seed
always had, `determinism_test` and `simulation_test`'s digests are
untouched, and the only thing that moved is what the season legitimately
moves: the hour, the water, and the sea life drawn after it (the fauna's
draws shift by one, and a fauna test that used to find a shark in the
corpus by luck had to build one — a corpus with seasons in it has fewer
of every warm-water species).
