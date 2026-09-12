---
title: A start-card row the seed does not decide (the COAST) stores a value, never null, and re-reads the rows that depend on it
date: 2026-09-12
scope: pwa/src/game/menu-start.tsx, pwa/src/game/settings.ts, pwa/src/game/seed-preview.tsx, pwa/src/game/url-params.ts
concepts: [start-card, settings, biome, weather, seed-preview]
---

Every other row on the start card is null-means-the-shore's-own with the
dealt answer marked, because the seed deals it. The coast is the one thing
the seed does not decide — the same number builds a different shore on each
biome — so `ride.biome` is a plain `BiomeId` with the engine's first id
as its default, the row has no `dealt`, and the settings merge checks it
with `isBiomeId` (a reserved id with no row is a level that throws on load,
so it is not a setting). Three things follow:

- The seed preview's cache and its "is this reply mine" check are keyed on
  seed AND coast, and the worker is told the coast in the request rather
  than reporting it in the deal.
- The WEATHER row's stops are the coast's own chart (`biomeOf(biome).weathers`),
  not `WEATHER_IDS` — a haze on the taiga is a stop the row could never
  stand on — so changing the coast re-reads the weather and drops a sky the
  new coast does not offer back to null.
- The URL carries it like the rest (`?biome=`), and the screenshot tool's
  `--biome` becomes that parameter and a suffix on the file name.
