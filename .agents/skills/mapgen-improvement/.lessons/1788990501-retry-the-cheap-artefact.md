---
title: When a late rule rejects a level, retry the CHEAP artefact before throwing away the expensive one
date: 2026-09-09
scope: engine/mapgen/generate.ts, engine/mapgen/rules.ts
concepts: [search, performance, rejection, course]
---

Adding R9's beam requirement pushed the reroll rate from 25 of 30 seeds to 26
and the mean build from 135 ms to 267 — but the rejections were nearly all
`the basin cannot carry a course`, i.e. `layCourse` returning null. A basin is
a route, a coast, a geology and two baked heightfields; the course laid in it
is a few hundred microseconds of arithmetic. Throwing the basin away because a
shuffled candidate list happened to put the beam-on gates too close together
is paying a build to re-roll a shuffle.

`search.courseTries` draws the course again inside the same basin first.
Rejected basins fell from 92 to 34 over thirty seeds and the mean build from
267 ms to under 200 — back where the old shore-first generator was. The curve
is flat past the tries the rule book sets, which is the tell that the
remaining failures are real: a basin with no beam-on straight anywhere in it
will not grow one. WHERE it flattens moves with the rules — four when this
was written, forty once R25's ocean leg took a third of the course out of
the running for a jump and R9's beam was read on the chord the window
becomes rather than the curve it replaces.

The general shape: when a rule is checked LATE, look at what the check
actually depends on. If it depends only on the cheap half of the pipeline,
re-run the cheap half. And read the reroll REASONS (`setOutputSink`, counting
warns and grouping the messages) rather than the reroll rate — the rate says
the search is working harder, the reasons say what to fix.
