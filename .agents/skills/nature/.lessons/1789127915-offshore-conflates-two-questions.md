---
title: "`offshore` is the distance from the NEAREST water's edge, so it cannot place anything that belongs in the open sea"
date: 2026-09-11
scope: engine/mapgen/geology.ts, engine/mapgen/basin.ts, engine/mapgen/rules.ts
concepts: rocks, mapgen, placement, offshore, river
---

`layBasin` builds one field out of three things — `offshore = max(corridor,
sea)`, then the islands cut out of it — and the `max` is where the
information goes. Once the corridor has won a cell, nothing downstream can
tell whether the water there is the sea's or a bay's, because the number is
the same number.

That is why sea stacks were standing up the middle of rivers. A stack's band
is 30–170 m and a route corridor is 34–95 m of half-width, so the middle of
a wide channel — or a river mouth, which takes the corridor's own width —
reads as 95 m offshore and passes the band. Eleven per cent of the stacks on
a 40-seed sweep were within 40 m of the river's own centreline.

Three things worth keeping:

- The open sea has a straight edge and the basin knows where it is
  (`seaHeading`, `seaOffset`). `x·sin + z·cos − seaOffset` is the honest
  "how far out to sea is this", it is deeply negative up any channel
  whatever its width, and `layOceanBasin` builds a circuit's offshore field
  out of the very same expression, so one formula covers both tracks.
- Hold a sea-made kind to BOTH bands, not to the sea's instead of the
  nearest's. `analyzeSolid` checks the offshore band off a PUBLISHED level
  and a published `Level` carries no sea line, so a placer that swapped one
  band for the other would lay rocks its own analyzer refuses. Requiring
  both keeps the pair consistent with no change to the exported shape — and
  "out in the ocean AND in near the shore" is the rule you actually wanted.
- Gating cost 25% of the stacks (129 → 97 over 40 seeds, one level in 40
  with none) and no test noticed. Count per level before and after; the
  placer gives a rock a bounded number of tries and simply drops it, so a
  band tightened too far thins the coast silently.
