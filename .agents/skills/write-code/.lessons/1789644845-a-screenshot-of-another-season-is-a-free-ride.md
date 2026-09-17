---
title: `make screenshots ARGS=--season=…` (or `--hour`, `--weather`) only moves the day on a FREE ride — pass `--mode free`, or the picture is the level's own day with the flag silently ignored
date: 2026-09-17
scope: scripts/screenshot.mjs, pwa/src/game/new-game.ts
concepts: [screenshots, season, tooling, lab, free-ride]
---

`gameFor` in `new-game.ts` reads the day rows (season, time, wind, swell,
weather) off the settings only when `freeRides(s)`; every measured mode rides
the level's own day, by design. The screenshot lab defaults to a race, so
`node scripts/screenshot.mjs --biome arctic --season winter` came back as the
autumn the seed dealt, at the same hour, with no ice on it — and nothing
warned. Add `--mode free` whenever a shot asks for a day the seed did not
deal. The same holds for `--hour` and `--weather`.
