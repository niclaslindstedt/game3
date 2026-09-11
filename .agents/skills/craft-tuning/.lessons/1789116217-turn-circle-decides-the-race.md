---
title: On a gated course the TURNING CIRCLE decides the race, not the top speed — bench the flat steady turn before reading any pace column
date: 2026-09-11
scope: engine/game/defs/craft.ts
concepts: [roster, sim, steering, tuning, measurement]
---

A missed gate is `course.missedPenalty` (5 s) and the generator's gates are
60–100 m apart, so how tight a hull comes round dominates `make sim`'s pace
by more than power, mass and drag together. Measured: with turning circles
spanning 18 m (stand-up) to 80 m (musclecraft) at half top speed under full
lock, the stand-up missed 17 gates over ten seeds and the other three missed
81–91, and it led the sweep by 38% on pace while having the LOWEST top speed
on the roster. Compressing the circles to 26–49 m — same order, every craft
keeping the archetype's shape — brought the field to within 5.5%.

So: bench the steady turn per craft (flat synthetic level, `sea: { hs: 0.01 }`,
full lock and full throttle, average the last seconds; radius `v/w` with the
WORLD-frame yaw rate, because a leaned hull reads roll as body yaw) BEFORE
concluding anything from a pace column. A roster whose radii span more than
about two to one has one craft that wins every gated course regardless of
what its other numbers say.

`sponsonBite` is the per-craft lever — it scales the carve term and is read
per STEP, so variants A/B correctly in one process. It is strong: on the
skiff, 0.8 → 1.9 runs the radius from 83 m to 13 m. Keep the resulting
lateral g near 1 or the bot's steering loop weaves (see `bot-improvement`).
