---
title: A control read off an input's SHAPE needs two gates — a threshold for what it may spend inside a flight, and an ARMING for what the flight inherits across the launch
date: 2026-09-13
scope: engine/game/strokes.ts, engine/game/craft.ts
concepts: [flight, air, dead-band, arcade, game-feel, tuning]
---

`strokes.ts` prices a stroke by how far the input rose above a low-water
mark, and zeroed that mark on every non-flying step. The threshold
(`pumpRise`, `whipRise`) keeps a trim flick out of the trick WITHIN a
flight — but a mark that starts every flight at zero reads an input the
rider was ALREADY holding as one whole rise on the first flying step. Off a
ramp that is the feature (a lean held up the deck is the backflip). Off a
crest it is the bug, and the two are indistinguishable to a threshold: the
steer axis is held for most of a real ride, so the water dropping away at
the top of a wave spent a throw the rider never made — 3–6 throws and 0.98
of a barrel roll over thirty seconds of one held turn, with `craft.ts`'s
`flown` folding the landing assist away on the same stroke.

The fix is a second gate on the SAME reading: every step the hull has
something under it rearms the mark, zeroed on a ramp's deck and set to the
input already held on the water. Two clauses matter.

- Arm on `!c.airborne`, never on `!flying`. `flying` needs `minAir` past the
  launch, so ~24 steps of every flight are "not flying" with no contact
  under the hull; rearming there takes a rider's own throw back off him a
  fifth of a second after he made it, and kills the ramp hold outright.
- Read the deck off `contact.onRamp`, not `overRamp` — `overRamp` is true
  for a hull merely FLYING across a ramp's footprint.

Bench it on a real sea (`syntheticLevel({ windSpeed: 12, depth: 25 })`),
holding one axis for thirty seconds, counting strokes and `∫ −wz dt` per
airborne stretch. A ramp bench cannot show it: the ramp is the case the old
rule was right for.
