---
title: A `surfaceAt` benchmark lies unless you check the SHARES at the sample point and the size of `held` — one made a 70 % frame regression read as 5 %
date: 2026-09-11
scope: engine/game/water.ts
concepts: [performance, measurement, spectrum, tuning]
---

`surfaceAt` walks the field BAND BY BAND and skips a band whose share at
the point is under a thousandth. So a benchmark at the wrong point measures
a skipped branch: `level.start` on seed 38 is up a sheltered channel where
the OCEAN band's share is 0.00, and timing there said an ocean component
cost 6 ns. Sampled where the band is actually carried — 400 m offshore,
share 0.97 — it costs **140 ns**, against ~300 ns of fixed work. That error
shipped `components: 16`, which is 17 ms of `surfaceAt` for the design
grid's 5400 vertices against 10 ms at eight, and it came back as "fps is
hurting".

**Print `seaShares` at the sample point before believing any per-component
number**, and quote the cost as ms for a 5400-vertex frame
(`DESIGN_WATER`), which is what the renderer actually pays.

The other way the same benchmark lies: `held` is a module-level
`Float64Array` sized from a TUNING expression (`3 * (components · (1 +
ladder rungs) + localComponents)`), and a typed array silently drops a
write past its end. Adding components to the field without growing that
expression is not an error — it is a surface full of NaN and a `surfaceAt`
deoptimised into the slow path, which benchmarked 5995 ns/sample against
the real 887. Same for `shares`, sized `2 + ladder rungs`.

So: treat any `surfaceAt` timing that moves by an order of magnitude as a
bug in the harness until proven otherwise, and any that barely moves when
you added work as a skipped band.
