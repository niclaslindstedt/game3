---
title: A field taken off a run gives back its RNG draws but never the water it moved — a shared field the hulls write makes a fielded run unreplayable from a tape alone
date: 2026-09-17
scope: engine/game/rivals.ts, engine/game/wash.ts, pwa/src/game/ghost-run.ts
concepts: [state, rivals, determinism, wash, ghost]
---

`dropField` exists so a ghost can be built the way its run was built — the
grid's per-rival weight and pace draws off `state.rng` — and then cost one
hull of physics instead of twelve. That made the field a bookkeeping matter
until the wash landed: every rider's trail stands on the ONE sea
(`SeaState.washes`), so eleven hulls are also eleven wakes the player's own
probes read. `ghost_test`'s fielded case had claimed the replay lands on the
same centimetre, and it went red the day the wash merged — the ghost was
riding water no rival had touched.

Two halves to the answer, and they are not the same half. The trails come
OFF with the field (otherwise a drop leaves wakes nobody is laying, which
the hull still feels and every sample still pays to read) — but nothing puts
them BACK, so a run ridden among a field cannot be replayed from its
controls. That is survivable here only because a tape is kept for the two
modes that ride alone; the contract to state is the STREAM, and the test
reads it against a fielded run whose trails were spliced off the sea by
hand, leaving the stream as the only thing that can still put the two runs
apart.

Reach for this whenever a system starts writing a field that every rider
reads back: ask what a state built the same way but stepped by fewer riders
now inherits, and whether any claim of exact replay still holds.
