---
title: Draw a new per-level property LAST in the seeded stream and the whole shore stays byte-identical — which is what makes a level knob safe to hand a player
date: 2026-09-16
scope: engine/mapgen/generate.ts
concepts: [determinism, rules, seed, knobs]
---

R36 added a swell height to every `Level`. Drawn where it "belonged" — beside
R12's wind, near the top of the attempt — it would have shifted every draw
after it, so every seed's course, rocks, sea life and sky would have re-rolled
and every level anyone had ridden would be a different level. Drawn AFTER the
fauna, at the very end of the stream, `mapgen_test`'s gates, solids, start,
wind, weather and fauna all came back `toEqual` the old ones on every seed.

R19's weather and R13's season already sit late for the same reason and say so
("no sky makes a basin unrideable"), so the slot is a convention, not a trick —
the rule is that **anything the SEARCH does not judge goes last**, in the order
it was added.

It is worth more than backwards compatibility. It is the property a player-facing
knob needs: `GenerateOptions.swell` is read off the option rather than drawn
(R35's `tricks` flag is the same shape), so the chart on the start card is the
course they ride at any setting, and `expect(asked.course.gates).toEqual(
dealt.course.gates)` is the test that says so. Write that test with the knob —
it is the one that fails the day somebody moves the draw.
