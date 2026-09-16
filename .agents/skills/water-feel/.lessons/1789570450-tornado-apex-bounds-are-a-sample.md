---
title: The tornado's apex bounds in tornado_test are a chaotic SAMPLE — tune the mechanism, then move the rail with a reason, never tune dials against the rail
date: 2026-09-16
scope: engine/game/tornado.ts, engine/game/defs/sea.ts, tests/tornado_test.ts
concepts: [tornado, tuning, measurement, tests]
---

`tornado_test`'s "throws him twenty metres and more" (min apex over a
360 s ride) and "to a bounded height" (p50/p90/max) are read off a hull
riding an unsteered storm sea. They are estimates of the extremes of a
chaotic sample, and ANY dial change reshuffles which waves the hull meets.

Trimming `tornado.column` from 0.76/0.85 to 0.73/0.81 to pull a 45.9 m max
under the 45 m rail moved it UP to 47.3, and restoring the original tops put
it back to 45.9 with the min passing. Two cycles, ~20 s of suite each, and
nothing learned about the tornado.

So: tune against a FLAT-SEA bench where the quantity is deterministic (stand
the hull at a chosen height at a chosen `stands`, integrate, read the apex
and the carry), and only then run the suite. If a rail is still crossed,
decide whether the MECHANISM changed what the rail measures — a throw
modulated by `tornadoHeightGain` legitimately puts the top of the sample
above the column's own ceiling, because the crest's height adds to it — and
move the rail with that written down. The p90 is the tight bound; the max is
a "did a hull find a hover" rail and is worth keeping loose.
