---
title: Draw a new per-level field LAST in generate.ts's rng stream, and every existing seed keeps its geometry and every sim digest holds
date: 2026-09-09
scope: engine/mapgen/generate.ts, engine/mapgen/compile.ts
concepts: [determinism, rng, level, digests]
---

`generateLevel` draws everything for an attempt off one seeded stream in a
fixed order, so INSERTING a draw shifts every draw after it: the course, the
rocks and the bake all come out different, every seed re-rolls, and
`simulation_test`'s and `determinism_test`'s digests move. That is the right
cost for a rule that changes what a level IS, and pure waste for one that does
not.

So when the new field cannot make an attempt fail — the sky (R19) is the
worked example; anything cosmetic or presentational is the same shape — draw
it AFTER `laySolids` and immediately before `compileLevel`. Nothing upstream
moves, the levels are byte-identical apart from the new field, and the digest
suites stay green, which means the PR's diff is about the feature rather than
about a corpus that re-rolled.

Say so in a comment at the draw, because the placement looks arbitrary
otherwise and the next reader will "tidy" it up beside the other conditions.

The check that it worked is `npx vitest run tests/simulation_test.ts
tests/determinism_test.ts` — green means nothing upstream shifted.
