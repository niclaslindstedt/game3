---
title: A per-run feature that adds to a level rather than changing it goes in compileLevel AFTER the seeded stream, and carries a flag on the Level so the analyzer can score it
date: 2026-09-13
scope: engine/mapgen/compile.ts, engine/mapgen/trick-field.ts, engine/analysis/
concepts: [determinism, rng, level, digests, analysis, search]
---

R35's trick field is the worked example of a feature that is a LAYER over a
level rather than a change to one: it reads the finished course path and the
baked fields, draws nothing from `state.rng`, and is laid in `compileLevel`
after everything the seeded stream drew. The result is that `generateLevel(s)`
and `generateLevel(s, { tricks: true })` are the same shore with one list on it
or without — `determinism_test` and `simulation_test` stayed green with no
digest moving, and the PR's diff was about the feature.

Two things that are easy to get wrong and cost a rebuild each:

**The `Level` has to carry the ASK, not just the result.** `analyzeLevel` is
handed a `Level` and nothing else, so an empty `ramps` list is indistinguishable
from a level that never wanted one — and without `Level.tricks` beside it the
analyzer cannot fail a field that came out empty, which means the generator
cannot reroll the sub-seed for a better coast. Same shape as `pace` and
`rampWidth`.

**The layer and its check must share their numbers by IMPORT, not by agreeing.**
The first cut had the layer computing `deckLength + landing` from the mid-band
and the check computing it from `length.max`; one metre apart, and a quarter of
all seeds were refused by their own analyzer. Export the geometry from the
module that lays it (`trickDeck`, `nextAfter`) and have the check call it.
