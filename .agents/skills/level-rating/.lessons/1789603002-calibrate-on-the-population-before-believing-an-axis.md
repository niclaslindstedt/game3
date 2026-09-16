---
title: Calibrate every axis on the population before believing it — three of the eight measured nothing on the first pass, each for a different reason
date: 2026-09-16
scope: engine/rating/index.ts, scripts/rate-level.mjs, scripts/difficulty-preview.mjs
concepts: [rating, calibration, corners, rocks, sea, sweep, schematic]
---

The first sweep (48 seeds a coast, as races, tricks runs and circuits)
came back with corners pinned at 1 on two thirds of the levels, rocks at
0 on nearly all of them, and the sea at 1 on a third. None was a scale to
nudge; each was a MEASUREMENT reading the wrong thing, and only the
schematic said which:

- CORNERS read a radius off three neighbouring path stations — a
  ten-metre chord — and every wobble in a line drawn at ten-metre
  stations was a hairpin. Read over `CORNER_SPAN` (three stations either
  side, a sixty-metre chord, about a hull's turn-in) it separated the
  tight half of seed 38 from its sweeping half at a glance.
- ROCKS counted solids inside one and a half berths of the line, and
  R6 already guarantees the berth is empty, so the count was of the rule
  and not of the coast. A flat forty-metre reach (`ROCK_REACH`) is what
  a rider reads at speed, and it put the skerry coast at one to eight a
  kilometre and the warm coast under three, which is what the two coasts
  ARE.
- THE SEA on a linear scale pinned every level with a groundswell over
  the scale, and R36 deals ten metres to one shore in eight. A square
  root — a wave's steepness grows with the root of its height — spread
  them without losing the storm at the top.

The order that worked: sweep with `--stats`, look at the `at 1` / `at 0`
columns, draw the two extremes with `make difficulty`, and only then
decide whether the scale or the measurement moves. The rest of the
calibration (tight 0.5, ramps 5/km, rocks 8/km) was scales, and took one
more sweep.
