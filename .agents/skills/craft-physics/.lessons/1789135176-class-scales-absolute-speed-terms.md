---
title: A global speed multiplier silently rescales every v² term — anything quoted in absolute m/s becomes a different craft, not a faster one
date: 2026-09-11
scope: engine/game/defs/craft.ts, engine/game/craft.ts, engine/game/flight.ts
concepts: [tuning, speed-class, steering, flight, measurement, roster]
---

`craftAtClass` scales the pump. Almost every force in this engine is quoted
against the water in ABSOLUTE metres a second, so the class rescales them all
for free and nobody wrote that down: the nozzle's side force is a share of a
thrust that grew, `keelYaw` and the carve go as v², the flat plate in
`flight.ts` goes as v². Benched over 0.75 → 1.50 the skiff's peak yaw rate
off a step input went 33 → 132 °/s (k², exactly) while the rider's own air
authority — a constant N·m — did not move at all.

The class of failure: **a knob that scales a speed is a knob that scales
every squared term keyed on that speed.** Before shipping one, list the terms
with a v² in them and ask which of them the knob was meant to reach.

Two measurement traps met on the way:

- **The steady state and the transient answer differently.** The held yaw
  rate barely moved across the band (27 → 32 °/s) while the peak went 4×.
  Tuning against the steady figure would have found nothing wrong; what a
  rider feels flicking the bars is the transient.

And pick the invariant deliberately, because several are defensible and they
disagree: holding the yaw RATE flat, the turn per METRE of track flat, or the
turn radius flat are three different exponents. Per metre of track is the one
that decides whether the same line still takes the same gate.

When a craft refuses to follow the others, print `planing`, `wetted` and the
roll before blaming the dial: the dart's high-class turn collapses because it
rolls to 25° and comes out of the water, which no deflection can answer.
