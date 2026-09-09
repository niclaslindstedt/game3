---
title: Widening the coast's shape breaks every rule that held by luck on a gentle one — re-read the checks and the tests' proxies, not just the generator
date: 2026-09-09
scope: engine/mapgen, engine/analysis, tests/mapgen_test.ts
concepts: [shore, course, analysis, tests, curvature]
---

Raising `shore.wander` and adding inlets (R15) turned three quiet
approximations into failures at once, and none of them was in the code the
change touched:

- **`straighten` in `course.ts`** replaces an arc with its CHORD, so the
  straight it leaves is shorter than the corridor that has to sit in it. On a
  gentle coast that is centimetres; on a curvy one it was 5 m, and the run-up
  started in the bend. The window now widens its far end until the chord is
  long enough, and `chordOk` refuses a bend it cannot widen out of.
- **R2's "the plateau is flat past the reach"** was a check on ONE height. The
  hills now vary along the coast, so what is flat is the way INLAND —
  the ground's gradient projected on the offshore field's own.
- **`mapgen_test`'s R12 probe** read the offshore field 40 m either side of the
  shore's MIDDLE vertex to infer which way the open sea lies. An inlet turns
  the shore round on itself, so one vertex says nothing; averaging over the
  whole published line does.

The tell for all three: they fail on the seeds whose coast is most interesting,
which is exactly the population the change was for. Before widening a shape,
grep the analysis and the tests for the words `plateau`, `middle`, `chord` and
any single-point probe.
