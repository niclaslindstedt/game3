---
title: A band measured FROM a centre is deleted, not widened, once its multiplier reaches the half-span — and a one-way object laid both ways is an obstacle half the time
date: 2026-09-13
scope: engine/mapgen/trick-field.ts, engine/mapgen/rules.ts
concepts: [rules, ramps, analysis, measurement, tests]
---

Two ways R35's first cut shipped broken, both worth watching for in any rule
that widens an existing band or reuses an existing object.

**A widening can silently delete the rule.** R9's beam band is ±30° measured
FROM THE BEAM, so `BEAM_WIDEN` of 3 is ±90° — every heading there is, and the
check `|off − π/2| > beam` can never fire again. It reads in the diff like a
loosened constant and it is a deleted rule. Worse, a sweep looking for a tuning
number ran 2, 2.5, 3 with `sed` and left the file at the LAST value while the
comment described a different one. The fix that sticks is a test on the band
itself (`expect(trickBeam(1, 1)).toBeLessThan(Math.PI / 2)`), not on the
constant: a band that spans its whole domain is not a band.

**A ramp is a one-way object.** It is a wedge hinged at one end — ridden from
one side, and met from the other as a wall `collision.ts` pushes the hull out
of. Laying the field out AND back down the same line therefore put a deck
facing the rider every half stride, which reads as "some ramps are backwards,
I can't ride them" and is correct: they are walls. Two things were needed, and
the first alone was not enough: step the homebound pass to SEAWARD off the
line, and refuse any remaining head-on pair with an `inLane` test — because
R24's route doubles back, so two OUTBOUND decks on the legs of a hairpin face
each other with only the corridor's width between them, which no amount of
stepping the return pass aside would catch.
