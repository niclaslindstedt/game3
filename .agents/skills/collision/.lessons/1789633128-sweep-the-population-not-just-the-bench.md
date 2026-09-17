---
title: Before changing a contact, count what the SEED POPULATION actually deals — a coast can read as broken because it places nothing the rule applies to
date: 2026-09-17
scope: engine/game/collision.ts, engine/mapgen/biomes.ts
concepts: [solids, rocks, contact, measurement, sweep, biomes]
---

"The rocks are not collidable, tried in the mangrove" was two faults and a
third thing that is not a fault, and only a count over the seed population
told them apart. A twenty-line script over `generateLevel` for 24 seeds a
coast, classifying every solid by `top` against the hull's planing keel, is
seconds and is the first thing to run:

- **Taiga**: 1277 solids, 66% of them a wall before the fix and 72% after —
  so the contact change is a 6-point shift there, not a rebalance.
- **Mangrove**: 166 solids over 24 seeds (≈7 a level), **74% of them reef
  whose crown never reaches the air**, and the wall share unmoved at 26%.

That last row is the answer the bench could not give: `Biome.rocks` deals
the mangrove `{ skerry: 0.08, boulder: 0, reef: 0.5, erratic: 0, stack: 0 }`,
so the coast has under two strikeable rocks a level besides R25's mark, and
its reefs sit below the keel BY DESIGN. No contact fix reaches that — it is
a content choice in `mapgen/biomes.ts`, and changing it owes a row in
`mapgen/versions.ts` with the old behaviour as a trait.

The general move: a report naming a COAST is a prompt to count that coast's
own population before touching the shared model. Otherwise you fix a real
fault on the other coast, ship it, and the reporter sees no change.
