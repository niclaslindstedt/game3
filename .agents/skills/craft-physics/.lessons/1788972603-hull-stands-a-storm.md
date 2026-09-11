---
title: A head sea costs the skiff 72 → 55 km/h over eight seconds, and that is the slam doing its job
date: 2026-09-09
scope: engine/game/hull.ts, engine/game/craft.ts
concepts: [slam, chop, game-feel, air]
---

In the ordinary 1 m sea (`make ride SCENARIO=chop`) the skiff launches every
second or so with air up to 0.8 s and bleeds from 72 to 55 km/h over eight
seconds of head sea. That is the reference reading: the landings COST, and a
change that stops them costing has softened the slam rather than fixed
anything. Read the speed column of `chop` against those numbers before
concluding a hull is too slow in a sea — a hull that holds 72 km/h through
eight seconds of head sea is the bug, not the one that does not.
