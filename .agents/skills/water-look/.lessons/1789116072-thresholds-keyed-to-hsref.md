---
title: Every crest threshold in water-mesh.ts is keyed to `sea.hsRef` — the COAST's swell — so a much bigger sea is above all of them at every vertex and comes out solid white
date: 2026-09-11
scope: pwa/src/game/water-mesh.ts
concepts: [water, foam, renderer, shader]
---

The mesh judges how high and how steep a wave is standing against
`sea.hsRef`, the level's own headline sea: the crest tint (`CREST_SHARE ·
hsRef`), the frustum margin (`1 + 1.2 · hsRef`), the relative tilt bands
(`seaSlope` from `hsRef` and `sea.tp`) and the `hsHere` the whitecap and
breaking gates are scaled by — which inlines the ocean and local shares only.

Against a one-metre coastal sea, a thousand-metre one is past every one of
them at every vertex: the water renders as a flat white field, the exact
"snowfield" failure the tuning comments warn about, and it looks like a broken
shader rather than a threshold problem.

The fix that stays a no-op inside a level: read the storm ALONE once a frame
at the craft (`stormSeaAt` — Hs and Tp, both 0 anywhere inside the bounds) and
take the bigger of the two seas for each threshold, energy-summing it into
`hsHere`. Once a frame is enough because the storm is uniform to a fraction of
a percent across a 200 m mesh 200 km out; per vertex it would be a fourth
field sample in the hottest loop.

Two traps beside it. `applySea` was called only when the `sea` OBJECT changed,
so a threshold that now moves WITHIN one sea needs its own last-applied guard.
And judge this with `SCENE=maelstrom` beside `SCENE=ocean` and `SCENE=cruise`:
the 20 m storm and the coast are what must come back unchanged, and only a
shot proves it.
