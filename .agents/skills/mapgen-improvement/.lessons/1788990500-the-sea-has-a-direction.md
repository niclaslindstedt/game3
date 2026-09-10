---
title: Once the course can run any way, the SEA'S DIRECTION is the biggest single thing about a level — and every number tuned on a coast-parallel course was tuned at one angle to it
date: 2026-09-09
scope: engine/mapgen/rules.ts, engine/mapgen/course.ts, engine/analysis/index.ts
concepts: [course, air-gates, wind, waves, rideability, measurement]
---

A course laid ALONG a coast the wind blows off (R12) meets the swell at one
angle for its whole length, and the old rule book quietly assumed it. R24
draws the line free in the plane, so a leg can run into the sea, down it, or
across it — and the same hull, in the same wave height, over the same depth,
is a different machine in each.

**Measured, three ways, before anything was changed.** Riding every ring on
twelve seeds with all four craft: a ramp pointing within 60° of the way the
waves travel was threaded on 1 run in 36, one within 60° of dead into them on
3 in 44, and one ACROSS them on 11 in 36. Over the same corpus the hull's
median pace was 9.0 m/s against the old shore-first generator's 16.9 — with
the same median wave height (1.66 m against 1.64), the same median depth
(10.0 m against 9.8) and the same steering effort (mean |steer| 0.36 against
0.41). What was five times higher was the dives and the capsizes. The pace
went into meeting the sea, not into cornering, and the guess that it was the
corners cost an afternoon.

**So R9 gained a beam requirement** — a run-up lies within `ramp.beam` (30°)
of a right angle to the waves — and the air-gate take rate went from 17% to
27% of rings on a 24-run sweep, with every other column improving too. The
rest of the gap is the rider, not the level.

**The trap this leaves.** Any constant in the rule book that was measured on a
coast-parallel course is a constant measured at ONE angle to the sea, and the
ones that touch pace are the suspects: `ramp.runUp` (60 m was enough for the
slowest hull to reach lip speed on flat water in 40 m, and not enough in a
seaway after a corner — now 160 m), `air.lipSpeed`, `gate.spacing`,
`course.radius`. Re-measure one before trusting it, and re-measure it on
GENERATED levels rather than on `tests/support/synthetic.ts`, whose flat bed
and straight shore are the old assumption in fixture form.
