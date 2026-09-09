---
title: Content that MOVES can be a pure function of (placement, t) instead of state in the step loop
date: 2026-09-09
scope: engine/game, engine/mapgen
concepts: [determinism, state, content]
---

The sea life moves continuously and is drawn every frame, and it added
nothing to `GameState`, nothing to `step()` and nothing to the replay. The
generator stores a LOOP per pod (centre, radii, heading, period, sense,
phase, a scatter seed) and `engine/game/fauna.ts`'s `faunaPose(pod, i, t,
out)` says where any one animal is at the engine's own clock — the same
shape as `water.ts`'s `surfaceAt`, and for the same reason: a pure function
of (placement, t) cannot drift between a run and its replay, costs the
120 Hz step nothing, and lets the renderer ask only for the animals it can
actually see.

Reach for this before adding state whenever the new thing does not INTERACT
with the craft. The moment it has to react to the hull it needs state and
the trade is gone — but until then, storing the beat rather than the
position is strictly cheaper on every axis.
