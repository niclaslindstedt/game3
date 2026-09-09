---
title: A new generator draw goes at the END of the seed's stream, or every existing level moves
date: 2026-09-09
scope: engine/mapgen/generate.ts
concepts: [determinism, mapgen, seeds, content]
---

Adding R20's sea life meant taking new draws off the level's seeded RNG.
Taken anywhere but the end, the shore, the course and the rocks a seed
produces all change, every simulation digest moves, and the diff looks like
a physics regression. Taking them AFTER R19's weather draw — which is
itself at the end for the same reason, and says so — left
`determinism_test`, `simulation_test` and every `make sim` digest untouched,
so the PR's table is a clean no-op and the new system is the only thing in
it.

The same order applies to the rejection loop: anything the analysis can
FAIL a level on must be drawn before the analysis runs (it is), but nothing
drawn late may feed the search, or the "drawn last" property is gone. A new
content system that no rule rejects a level over belongs at the end of
`generateLevel`'s attempt body, beside `pickWeather`.
