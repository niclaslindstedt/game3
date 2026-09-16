---
title: Stage a two-craft meeting well OFFSHORE and never perfectly aligned — the synthetic shore is at z = 0, and two identical hulls on the same axis touch tangentially and read as no contact
date: 2026-09-16
scope: tests/support/synthetic.ts, engine/game/hull-contact.ts
concepts: [scenario, staging, synthetic, contact, rivals]
---

Three traps, all of which look like engine bugs and are all staging:

- **`syntheticLevel`'s sea runs from z = 0 OUT**, with land behind it
  (`syntheticGround`). Standing a craft at `z = 0` puts it on the beach, and
  the ground's penalty spring launches it — `vy` 3.4 m/s and `wx` 2.8 rad/s on
  step one. Stand anything that is about the WATER at `z >= 200`, where the
  bed is flat at its full `depth`.
- **Heading is not the world axis.** Staging a pair along the shore means
  `heading = π/2`, where the craft's forward is world **+x** — so a "half a
  beam to the side" offset is `z`, and offsetting `x` puts one hull AHEAD of
  the other. Quote every pose in the victim's own frame and rotate it out
  once, rather than mixing the two frames per case.
- **Perfect alignment is a tangency, not an overlap.** Two identical shells at
  the same `x`/`z` have their rails and their transoms exactly coincident, so
  the min-translation depth through those faces is exactly 0 and `clipHulls`
  correctly reports no contact. Offset by a couple of tenths of a metre in
  both axes before asserting that a contact happens at all.

An intercept also has to account for the victim MOVING: stand the striker at
`aim + victimVelocity·τ − strikerVelocity·τ` with `τ` the run-in time, after
letting both hulls trim out at their throttle for a second — a pair staged
from rest is a pair still settling when they meet.
