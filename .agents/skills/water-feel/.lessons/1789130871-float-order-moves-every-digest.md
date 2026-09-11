---
title: Reordering the multiply in `windAt` changes every sim digest — keep the level's own wind on its own terms and ADD the new one
date: 2026-09-11
scope: engine/game/wind.ts, engine/game/water.ts
concepts: [determinism, wind, tuning, sim]
---

Adding a second wind (the tornado's inflow) to `windAt` looked free: the new
term is exactly 0 everywhere a run is ridden, so nothing should move. Folding
both winds into one scale factor —

    vx: (mean * sin(toward) + inflow[0]) * gust * profile

— moved the digest on every seed in `make sim`. Float multiplication is not
associative: `mean · gust · profile · sin` and `mean · sin · gust · profile`
differ in the last bit, and a 120 Hz chaotic sim turns that into a different
run. The lab output was otherwise identical, so the only signal was the digest
column.

The fix is to compute the ORIGINAL expression unchanged and add the new term
beside it:

    const speed = mean * wind.gust * profile;   // exactly as before
    vx: speed * Math.sin(toward) + inflow[0] * scale

Adding a true 0 is exact, so `make sim` came back byte-identical.

Generalises to any term bolted onto a hot path that is meant to be inert in
the existing cases: **do not refactor the expression you are extending.**
Re-associating it is a silent, repo-wide behaviour change that reads as a
determinism regression in review. Take the baseline `make sim` BEFORE the
edit — it is the only thing that catches this.
