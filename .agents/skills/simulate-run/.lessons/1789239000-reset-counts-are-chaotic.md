---
title: A bot RESET count is chaotic in the seed — read it as a fleet total across seeds, never per seed, and never as evidence for a knob
date: 2026-09-12
scope: engine/sim, tests/simulation_test.ts
concepts: [simulation, bot, tuning, measurement, tests]
---

The bot decides on every step, so ANY change that moves its trajectory at
all re-rolls where it runs wide. Measured deliberately: ten generated seeds
against nine settings of a knob that perturbs the bot without making it
better or worse (an air-steer cap), the skiff's total resets came out 4, 5,
6, 8, 9, 9, 10, 11 and 4 — no trend, individual seeds swinging 0 ↔ 3
between NEIGHBOURING settings, and the untouched tree sitting mid-band.

Two consequences worth having before a tuning session:

- **A single seed's reset or miss count is never evidence.** A knob that
  "fixed seed 3" almost certainly re-rolled it. Sweep the knob over a handful
  of values and look for a TREND across the fleet; if the column is
  non-monotone over the sweep, it is noise and the knob does not touch it.
- **A per-seed assertion on resets has no margin.** `simulation_test`'s
  generated-levels cases pin `resets <= N` per seed, and any legitimate
  perturbation eventually trips one. What survives a re-roll is that the run
  is a RUN: it finishes, every gate is taken or paid for, and the pace is a
  race's.

`make sim`'s own summary is the fleet view and is the honest one to quote in
a PR — but quote the columns that got WORSE too (groundings and hits moved
up in the same pass that took nine gates off the missed column).
