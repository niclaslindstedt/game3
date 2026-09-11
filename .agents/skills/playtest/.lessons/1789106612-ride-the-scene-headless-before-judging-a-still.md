---
title: Before tuning anything off a still, ride the same scene headlessly for its events — a still that shows a landing where the scene names a dive is a pre-roll ridden by the wrong hands
date: 2026-09-11
scope: pwa/src/App.tsx, pwa/src/game/scenarios.ts, scripts/screenshot.mjs
concepts: [screenshots, scenarios, pre-roll, bot, events]
---

Two rounds of dive shots showed the hull riding on at 78 km/h with a road
behind it, and the effect under review was blamed. A thirty-line probe —
`aliasEngine(root)` from `scripts/lib/engine-alias.mjs`, `stageScenario`,
step the script for three seconds and print `state.events` — showed the
scene DOES dive at 0.68 s on that seed. The difference was the app: `stand()`
pre-rolls `?t=` before the shell has settled, and `inputFor` handed a
scene under the attract card to the bot, which levelled the hull the scene
had thrown nose-down. The script now comes first whatever surface is up.
Two habits from it: read the HUD in the still (speed, air time, the clock)
against what the scene promises before believing the picture, and after
restoring a file from a diagnostic build, REBUILD before the next shot — a
capture against the last build photographs the diagnostic, not the change.
