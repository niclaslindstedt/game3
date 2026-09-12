---
title: Euler pitch WRAPS at ±90°, so counting rotation from `c.pitch` reads a completed backflip as a reversal — integrate the body rate instead
date: 2026-09-12
scope: engine/game/craft.ts, engine/sim/
concepts: [quaternion, flight, measurement, sign-conventions, air]
---

`AGENTS.md` warns that `pitch` is DERIVED from `q` and must never be
integrated. The same trap bites MEASUREMENT, which is easier to miss because
nothing is being integrated into the state — a bench summing
`Δ = c.pitch − prev` per step, wrapped into ±π the usual way, still counts a
hull rotating steadily nose-up through vertical as a reversal, because
`toEuler` folds pitch back at ±90° and the roll flips 180° to compensate.

The symptom is a clean, plausible number of the WRONG SIGN: a craft doing
1.5 backflips off a wave was reported as −150° of nose-DOWN rotation, twice,
on two differently written counters. What proved it was tracing one flight
and seeing the pitch RATE steady at +270 °/s the whole way while the reported
pitch went 31° → 87° → −87° → 60°.

Count rotation as `∫ −wx dt` over the airborne stretch. `wx` is body-frame,
does not wrap, and is the quantity a flip is actually made of. The same
applies to any run-long total: net rotation over a ride cancels itself, so
count per airborne stretch and report the largest.
