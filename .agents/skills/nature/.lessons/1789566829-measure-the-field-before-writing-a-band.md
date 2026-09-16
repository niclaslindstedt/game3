---
title: A catalog's bands are written against fields the generator deals — measure the field first, or the band quietly excludes most of the level
date: 2026-09-16
scope: engine/game/defs/fauna.ts, engine/game/defs/fauna-warm.ts, engine/mapgen/biomes.ts
concepts: [fauna, placement, offshore, biome, generator, bands]
---

Two bands in the fauna catalog had been written from intuition rather than
from the field they are sampled against, and both cost most of a level:

- **`offshore` topped out at 250 m** on every row, while a level's offshore
  field reaches about 766 m and 42% of its water lies past 200 m. The outer
  half of every level was empty by construction and no test said so.
- **`temperature.min` was 4 °C** on nearly every cold row, while the taiga
  deals water from 2.1 °C. Twelve of forty seeds fell through the WHOLE
  catalog and carried one pod. Raising the floors to where the animals
  really are (a cod spawns at 0–5 °C, a rorqual feeds near freezing) took
  those seeds from 1–3 pods to 12–21 — a bigger win than every `perKm`
  change in the same pass put together.

So before writing or retuning a band, print the distribution of the field it
gates on, over a sweep of seeds and both coasts. Two probes, a few seconds
each:

- offshore: histogram `level.offshore.data` over water cells, and pair it
  with `-sampleField(level.ground, …)` per band — the depth a row needs is
  the second gate and it is the honest one, since a shelf falling from 6 m
  inshore to 40 m at the rim enforces "far out" on its own.
- temperature: `generateLevel(s, {biome}).water.temperature` over 40 seeds,
  sorted, printed beside the pod count. The cliff is obvious the moment the
  two columns are side by side and invisible from the catalog alone.

The same trap is structural, not numeric: every bird `home` kind (raft,
skerry, tree, shore) is inshore by construction, so a bird roster could be
complete and still leave the sky over the outer half of a level empty. Ask
what a placer CANNOT place, not only what it does.
