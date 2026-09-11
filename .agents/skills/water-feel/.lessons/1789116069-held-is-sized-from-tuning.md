---
title: `held` in water.ts is sized from a TUNING expression — add a band without growing it and every sample is silently NaN, and `surfaceAt` reads TEN TIMES slower
date: 2026-09-11
scope: engine/game/water.ts
concepts: [spectrum, performance, measurement, tuning]
---

`surfaceAt` keeps its two passes' per-component numbers in one module-level
`Float64Array held`, sized once from a TUNING expression (`3 * (components ·
(1 + ladder rungs) + localComponents)`). A typed array **silently drops** a
write past its end and reads `undefined` back, so adding components to the
field without growing that expression is not an error — it is a surface full
of NaN, and a `surfaceAt` deoptimised into the slow path.

This cost a whole wrong measurement. Probing "what would 48 more components
cost" by raising the band's count alone benchmarked 5995 ns/sample against
626; the real answer, once `held` matched, was 887. The 10× was the
out-of-bounds deopt, and it reads exactly like a catastrophic performance
result for the change under test.

So: when you change how many components the field carries, grow `held` in the
same edit, and treat any benchmark that moves by an order of magnitude as a
bug in the harness until proven otherwise. The same goes for `shares`, sized
`2 + ladder rungs`.
