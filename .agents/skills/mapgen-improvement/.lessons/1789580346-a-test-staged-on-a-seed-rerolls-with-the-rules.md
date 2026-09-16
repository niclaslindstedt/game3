---
title: A physics test staged on a GENERATED seed outside the corpus re-rolls with every generator or analyzer change — grep `levelFor(` and `generateLevel(` in tests before pushing a rules change, and re-measure each seed's claim
date: 2026-09-16
scope: tests/assist_test.ts, tests/support/levels.ts
concepts: [determinism, tests, analysis, rules, digests, ci]
---

`tests/assist_test.ts` stages its following-wave pair on `levelFor(29)`
because the swallow is the sea's own shape and the synthetic level has no
swell. Seed 29 is not in `LEVEL_SEEDS`, so the corpus digest diff that
proved "three of twelve taiga seeds re-roll" never looked at it; CI's shard
2 did, and the re-rolled level's sea no longer buried the hull. A test that
names a seed is a claim about that seed's level, and the level is a function
of the whole rule book AND the analyzer's reading of it.

Before pushing anything that can re-roll a seed, list every seed the suite
names (`grep -n "levelFor(\|generateLevel(" tests/*.ts`), digest each one
against `origin/main` beside the corpus, and for any that moved re-run the
test's own measurement (a twenty-line probe over `stageScenario`) across a
sweep of seeds to find one that still carries the property — with the
comment rewritten to the numbers measured on it, never the old seed's.
