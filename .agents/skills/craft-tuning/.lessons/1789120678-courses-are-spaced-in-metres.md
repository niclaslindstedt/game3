---
title: Courses are spaced in METRES and read no speed at all, so a speed class does not stretch them — it just gives the rider less time, and the sim shows it as missed gates
date: 2026-09-11
scope: engine/mapgen/rules.ts, engine/game/defs/tuning.ts
concepts: [sim, tuning, course, measurement]
---

`engine/mapgen/rules.ts` contains no reference to `topSpeedOf` or any craft
speed: gate spacing, ramp lead and ring placement are all fixed metres. The
one place the generator's suite mentions top speed
(`mapgen_test.ts`'s R18) is a LOWER bound — "the slowest craft can bring the
speed" — which a faster roster only helps, so nothing fails there and the
real cost hides until you run the sim.

Measured at `speedClass` 1.5 against 1, over the sim's corpus: every craft
still finishes, but missed gates go 5 → 32 on the dart and 24 → 37 on the
skiff, dives roughly double, and the PACE FALLS (marlin 39.6 → 35.6 km/h)
because a hull that overshoots a gate has to come back for it.
`tests/simulation_test.ts` fails outright — the bot misses 2 gates where 1
is allowed and takes 20–35 % LONGER round the synthetic shore while being
50 % faster.

So raising the class is a two-part change, and the second part is the
generator: a course whose spacing is a function of the same top speed. Until
that exists, the class ships at 1 and `make sim` is the check that says so —
a green suite does not.
