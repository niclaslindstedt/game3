---
title: One cull radius for a thirteen-species roster is the wrong question — derive each species' reach from its own height against a pixel line
date: 2026-09-11
scope: pwa/src/game/flora.ts, pwa/src/game/flora-defs.ts, pwa/src/game/settings-video.ts
concepts: [flora, rendering, culling, performance, distance]
---

The cover was already tiled and frustum-culled and it was STILL two thirds of the
frame's triangles (`--detail` medium 1.36M, and the medium→high slope says 616k of
that is flora). The reason was that `DISTANCE_LOOK.cover` is one radius for a roster
that runs from a 19 m spruce to a 40 cm heather mat, and there are 5528 of the
heather. At 720 rows through a 60° lens a thing `h` metres tall at `d` metres stands
`623 · h / d` pixels high, so a heather mat is under six pixels past forty metres —
the whole row was being submitted to the horizon to draw nothing.

`coverReach(height)` splits that one number thirteen ways. The trees come out past
any stop of the row and are cut by the fog as before; the reed, the sedge, the lyme,
the heather and the shingle stop within a hundred metres. Chase, river and
DISTANCE=high frames are pixel-identical; the only visible change anywhere was a
faint grain leaving a far bank in the HELICOPTER seat, at 4× zoom.

Two things that are easy to get wrong doing this:

- **The tile has to shrink with the reach.** A tile is kept while any part of it
  reaches inside the radius, so a 40 m reach inside a 128 m square is a 110 m reach.
  Bucket each species at half its own reach (floored, or the per-frame walk over the
  tiles costs more than the triangles it saves).
- **The mirror cannot be handed a different SET, only a PREFIX.** Both passes read
  one instance buffer, so a shorter reflection reach saves nothing until the relay
  lays the reflected tiles FIRST and `count` is moved between the two totals either
  side of the reflection pass. Done as a set-union test first it changed 141
  triangles out of 1.36M; done as a prefix it took another 170k.

And check the row's own radii against the fog before tuning anything else: MEDIUM was
drawing the shore to 900 m and the cover to 700 under a sky whose fog is complete at
588 m. The slack was free.
