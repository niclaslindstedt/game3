---
title: A per-craft pace swing on the default four seeds is usually the bot diverging, not the roster moving — re-run wide before believing it
date: 2026-09-11
scope: engine/sim/simulate.ts, scripts/simulate-run.mjs
concepts: [sim, bot, measurement, tuning]
---

A sea change that touched only sheltered water showed the dart falling from
51.3 to 46.6 km/h on the default four seeds — a 9% collapse of the fastest
craft, which reads as a balance regression. On thirteen seeds the same
change moved it 50.2 → 49.3. The four-seed number was noise: the bot is
deterministic but its whole trajectory re-rolls when any of the world moves,
so it takes different lines and meets different gates, and four seeds is not
enough for that to average out. Judge a roster movement on
`make sim SEEDS=` with a dozen or more before calling it a regression.

The same applies to the event counts, with one extra step: a grounding jump
is worth LOCATING before believing it. Groundings should be ≈ 0 because the
generator guarantees depth along the course path — so when the marlin's went
2 → 15, the question was where. Riding the bot and logging each `ground`
event's `level.offshore` and its distance to the nearest gate answered it:
every one was 34–102 m off course at negative offshore, i.e. the bot had run
up onto the beach, where no depth guarantee applies. That is a bot-line
divergence to report, not a physics fault in the change.
