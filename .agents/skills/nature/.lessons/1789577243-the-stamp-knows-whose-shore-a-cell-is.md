---
title: A surface that depends on WHICH water a point is beside is baked by the basin's stamp beside `offshore`, never worked out in `materialAt` from the river's line
date: 2026-09-16
scope: engine/mapgen/basin.ts, engine/mapgen/compile.ts
concepts: [surface, river, basin, offshore, classifier, performance]
---

The `bank` surface needs to know that a point's nearest water is the
river's past its mouth's run. `offshore` cannot say — a corridor's and a
river's distances are the same number — and a polyline walk of the river
inside `materialAt` is too slow for a classifier the terrain calls per
vertex, the flora per candidate and the analysis per probe. The one thing
that knows which line won a cell is the stamp in `layBasin`, at the moment
it writes `owed`: so the river's samples stamp a bank share alongside
(0 at the mouth, 1 by the end of `river.mouthRun`), it is zeroed where the
open sea's own edge won the cell, and `Basin.bank` is a heightfield the
classifier reads with one bilinear sample. Any future "whose shore is this"
question — an island's, a lagoon's — goes the same way: annotate the stamp,
never re-derive from the lines.
