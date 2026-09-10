---
title: A generator that draws blind rejects more, and that is the search working — read the MEAN build time, not the reroll rate
date: 2026-09-09
scope: engine/mapgen/generate.ts, tests/mapgen_population_test.ts
concepts: [search, rejection, budgets, performance]
---

The course-first route (R24) is drawn before there is any land for it to
answer to, so whether the water round it comes out as a basin (R15's share),
whether its coast is a quilt (R21) and whether its bends leave a straight
long enough for a ramp (R9) are all found out afterwards. Three seeds in five
draw one the analysis refuses.

That reads alarming and is not: a rejected attempt costs one build, the mean
build LANDED LOWER than the shore-first generator's (135 ms against 180),
and the alternative — a route that knew where the land was going to be — is
the shore-first generator again. The number that says whether a rejection
rate is affordable is the mean time, not the rate.

What IS worth chasing is a rejection cause that is an artifact rather than a
judgement. Two here were: R2's climb check read cell gradients where the
rule is about a profile, and islands were placed against their MEAN radius
while their rims are warped by up to `island.warp` of it, so they pinched
the corridor they were supposed to stand clear of. Both showed up as "the
basin cannot carry a course" and neither was about the basin.
