---
title: A rule that exempts part of the course has to be DERIVED from the finished level, and every other instrument that reads the same measurement needs the same exemption
date: 2026-09-10
scope: engine/analysis, tests/analysis_test.ts, tests/mapgen_test.ts
concepts: [analysis, course, offshore, tests]
---

R25 lets one stretch of the path stand outside R1's band. A `Level` carries
no route, so the analysis cannot be told where that stretch is — it FINDS
it (`oceanRun` in `analysis/reach.ts`: walk the path, take the longest run
of samples past the ceiling). That is the honest shape, and it has a bonus:
a course that wandered out of the band somewhere ELSE is not the longest
run, so R1 still fails it.

The cost is that the exemption has to be repeated everywhere the same
measurement is made, and they are easy to miss — `analyzeLevel`'s path walk
AND its gate loop, `mapgen_test`'s R1 and its R24, and the SEARCH
(`layCourse`'s `legalAt`, which lifts the ceiling inside the mark's own
zone rather than by path distance, because at that point there is no path
yet).

The sharpest trap is in the FIXTURES. `analysis_test` broke R1 by carrying
a gate "120 m to the shore's left" and a path station 200 m sideways —
both of which now land in legal water, because a basin has no fixed side
and out past the ceiling is where R25's leg goes. Break R1 on the FLOOR
instead: walk down the offshore field's own gradient until the point is
actually on land (one step along the gradient is not enough — beside a bend
of a channel it can come out further from the water than it started).
