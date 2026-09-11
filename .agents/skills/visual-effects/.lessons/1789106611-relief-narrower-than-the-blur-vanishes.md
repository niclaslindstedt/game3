---
title: A mark's relief has to be wider than the relief blur (about two metres) or the water never bends for it — the map holds it and the grid never sees it
date: 2026-09-11
scope: pwa/src/game/wake-profile.ts, pwa/src/game/wake.ts, pwa/src/game/water-shader.ts
concepts: [wake, relief, splash, shader, render-target, mip]
---

The water shader reads the map's crest and hollow channels `WAKE_RELIEF_LOD`
levels down (three: a two-metre blur) and the near grid's cell is a metre and
a half, so a feature narrower than that is smoothed into nothing before a
vertex stands on it. The splash's ring wave at 1.6 m wide was in the map
(painting its channel into the foam proved it) and still moved no water;
at 3.2 m it does. The same holds for a crater: make it the hull's length,
not the beam. Before touching a height number, prove the mark is in the map
the cheap way — paint its channel into the foam for one build — and read the
mark's width against the blur; a mark that is only ever half a blur wide
needs its foam or its churn to carry it, because its relief never will.
