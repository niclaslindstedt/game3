---
title: Four seeds cannot tune a per-craft column — `make sim`'s groundings and dives swing 3× on a knob change at that sample, and before/after must be the SAME seed set
date: 2026-09-10
scope: engine/game/defs/craft.ts, engine/sim
concepts: [sim, tuning, measurement, roster]
---

The default sweep is four seeds, and at that size the plain columns are bot
chaos rather than craft character. Measured this session: one knob moved on
the otter gave groundings 15, then 4, then 3 over three values — a swing that
reverses the conclusion depending on which two you compare. Widened to ten
seeds (`make sim SEEDS=1,3,7,11,19,23,38,57,88,123`), the same comparison
separated cleanly and stayed put on a re-run.

Two rules that follow:

- **Tune on ten seeds, not four.** `make sim CRAFT=<id> SEEDS=...` is the
  cheap form — one craft over the wide set costs about what four craft over
  the narrow one does, and it is the number you can actually act on.
- **Compare the same seed set on both sides.** It is easy to take a four-seed
  baseline early, widen to ten while iterating, and then put the two tables
  side by side in the PR. They are not comparable. Re-take the baseline on
  the final seed set — `git stash` the tree, run the sweep, `git stash pop` —
  which costs one sweep and is the only honest before/after.

`fin` is the one column that reads at four seeds, because it is a floor
rather than a measurement: any craft finishing fewer than all of them is a
problem whatever the sample.
