---
title: Give the wake's SHAPE one owner and its COLOUR another — relief spread across the marks that carry the foam disagrees with itself
date: 2026-09-12
scope: pwa/src/game/wake-profile.ts, pwa/src/game/wake.ts
concepts: [wake, relief, foam, stern-wave, fan, road, architecture]
---

The relief started out scattered: the road carried a hollow, the fan carried a
crest at its rails and a trough inside them, the jet carried a trench. Each
was laid on the footprint its FOAM wanted, and each therefore got the shape
wrong for a different reason.

- The road's hollow was a beam wide — narrower than the blur, so a third of
  its depth ever reached a vertex.
- The fan's crest was aged on the fan's own `CREST_LIFE`, which died while the
  white it belonged to was still on the water: the wedge read as paint on a
  flat sea for the last two thirds of its life.
- Nothing anywhere put water UP on the centreline, because no mark's foam
  wanted to be there.

Collapsing all of it into one mark — a stern wave with no foam and no churn,
on a section cut to follow the diverging crests rather than the white — fixed
all three at once and cost one draw call and 3,237 triangles. The road and the
fan became foam-only; `out.up = 0; out.down = 0` in both.

The rule that falls out: a wake's FOOTPRINT is decided by what it is for. Foam
is a per-pixel texture and wants the edge; relief is read blurred and per
vertex and wants width and a long life. Two marks over the same water with
different jobs are cheaper and truer than one mark compromised between them.
And relief stated in two places will drift — the fan's crest and the arms were
the same physical wave, and they disagreed about how long it lived.
