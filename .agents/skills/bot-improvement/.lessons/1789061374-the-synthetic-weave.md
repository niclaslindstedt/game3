---
title: The bot weaves eight metres either side of the line at 80 km/h under the synthetic shore's 0.8 m beam sea, so a buoy pass there is a coin the sea's phases toss
date: 2026-09-10
scope: engine/sim/bot.ts, tests/simulation_test.ts
concepts: [steering, weave, synthetic, tests]
---

On `syntheticLevel({ windSpeed: 5 })` the skiff's track past the 100 m gates
swings between z ≈ 31 and z ≈ 51 about the line at z = 40, heading 58°–120°,
with landings between — and the same on the engine before and after the
wave phase was rewritten, so it is the bot's steering under a beam sea, not
the sea. With a buoy half a dozen metres off the line that is a pass by a
metre on one seed and a miss by two on the next: a change to the sea's
phases flipped seed 9 from one charged miss to three, the ring included,
without any change to the bot. `tests/simulation_test.ts`'s skerry case
rides seed 3 for that reason. The weave itself is a steering-gain question
waiting here: aim damping against the lateral drift, or the lean, before
the next sea change rolls the dice again.
