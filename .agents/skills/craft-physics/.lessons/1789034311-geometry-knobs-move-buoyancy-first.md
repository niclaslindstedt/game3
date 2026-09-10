---
title: A probe-geometry knob moves BUOYANCY and lift together, and buoyancy usually wins — measure its direction before writing the comment that claims one
date: 2026-09-10
scope: engine/game/hull.ts, engine/game/defs/craft.ts
concepts: [probes, buoyancy, hull, tuning]
---

`bowRise` (the keel's rocker) was added expecting the real-world reading — "a
fine, high bow lifts over a sea and refuses to bury". The model does the
OPPOSITE: raising the forward keel probes lifts their VOLUME clear of the
water, so there is less buoyancy forward to hold the nose up, and that
outweighs the extra bow lift the steeper `p.slope` earns. Staged nose-down
landing, skiff, rocker 0.75 / 1.0 / 1.25: deepest bow 0.284 / 0.319 / 0.347 m,
pitch 0.0 / −1.7 / −2.9°.

The general shape: every probe knob moves at least two terms at once, one
hydrostatic and one hydrodynamic, and the hydrostatic one is the bigger
number at the speeds a hull actually lands at. So the sequence is measure the
direction FIRST, then write the catalog comment to what the model does — the
truthful story here turned out to be better anyway (a rockered freestyle
stand-up submarines; a deep-forefoot tourer does not).

Bench it on a staged nose-down landing rather than in `make sim`: over ten
seeds the DIVE column moved by less than its own noise on this knob, while
the staged drop separated the three variants cleanly.
