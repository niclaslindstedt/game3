---
title: Buy room between the waves from the band's TAIL, never from the period — `periodScale` pays for it with the bow going under
date: 2026-09-16
scope: engine/game/defs/sea.ts, engine/game/water.ts
concepts: [spectrum, steepness, feel, tuning, measurement, sim]
---

"The waves are too close together" has two dials and only one of them is
affordable.

`periodScale` is the obvious one — wavelength goes as its square — and it
works: 0.95 → 1.15 took the tightest seed's crests from 45 m to 60 and the
encounter period from 1.4 s to 1.8. It also takes away THE BOW GOING UNDER. A
longer wave travels faster (c = √(gλ/2π)), so a following sea overtakes the
hull more slowly and stops burying it. Measured over `LEVEL_SEEDS` with the
bars held fully forward through the `following` scenario: **eleven of twelve
seeds put the hull under at 0.95, ONE did at 1.15.** `tests/assist_test.ts`'s
deliberate-dive case is the tripwire, and it fires on seed 29 alone — the
corpus probe is what shows it is not one seed.

`bandHigh` is the affordable one. The tail carries a few per cent of the
energy and most of the CRESTS (Tz = √(m0/m2), and m2 is all tail), so cutting
it removes the chop between the real waves while leaving the peak's face
exactly where it was. 2.4 → 2.0 (with `minPeriod` 2.5 → 3.0, or the absolute
floor undoes the cut on every slow-peaked sea) dropped the corpus's launches
274 → 194 with the air per launch an eighth HIGHER — the lost ones were
bounces, not jumps — and cost the dive nothing: 11/12 seeds either side.
Below 2.0 it starts costing: 8/12 at 1.85, 5/12 at 1.7, for two more metres
of spacing.

The method matters as much as the answer. Five dials were moved at once and
three had to be unwound; **bisecting one dial at a time against a FEEL probe**
(not the lab's headline — the headline barely moved) is what found it. Write
the probe before the tuning, run it over the whole seed corpus, and count
seeds rather than reading one.
