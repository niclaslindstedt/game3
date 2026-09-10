---
title: A start-card row that overrides part of a dealt level says which part — SEASON moves the sun and nothing else
date: 2026-09-10
scope: pwa/src/game/menu-start.tsx, pwa/src/game/settings.ts, engine/game/step.ts
concepts: [start-card, settings, seasons, overrides]
---

`createGame({ season })` re-resolves a named TIME against the asked
season's daylight window and moves the sun — and leaves the water's
temperature and the fauna the level's own, because they were dealt with
the level and re-dealing them would be a different level under the same
seed (a bug report's URL would stop being a repro). Same shape as `hour`
and `weather`: an override moves the SKY, never the shore or the sea. Say
so in the option's doc and the row's hint, or the next row added here will
quietly re-deal something.

The row itself was the cheap part: `settings.ride.season` (null = dealt),
`SEASONS` checked in `mergeSettings`, `deal.season` off the seed preview,
`?season=` in `App.tsx` and `screenshot.mjs`, and the round-trip test's
expected blob gains `season: null`. Five rows on the card fit both
reference viewports without touching the CSS.
