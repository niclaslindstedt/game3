---
title: The bot's air caps must be the LOOP's own numbers, never the engine's stroke gates — a PD tuned against a small cap over-rotates the moment it is handed a big one
date: 2026-09-13
scope: engine/sim/bot.ts
concepts: [bot, air, flight, tuning, simulate, measurement]
---

The levelling loop caps what it asks for in the air so the engine never
reads its trim as a stroke of the pump or the whip (`strokes.ts`). Those
caps happened to equal the engine's stroke thresholds when both were small,
and reading them straight off `TUNING.flight` looked like the "stated once"
discipline. It is a trap. When the gates moved up to the TOP of their axes
(`pumpGate` 0.8, `whipGate` 0.85 — only a maxed input is a trick), following
them handed a PD whose gains were tuned against 0.22 roughly four times the
authority, and it promptly used it: the bot stood its own hull on its tail
to trim a landing. `make sim` caught it as RESETS, not as pace — seed 1 went
3 → 4 and seed 3 went 3 → 7, tripping `simulation_test`'s `resets <= 3`.

So the profile carries `airLeanCap` = 0.22 and `airBarsCap` = 0.3 of its
own. They sit far under the gates as a CONSEQUENCE of being what a PD with
these gains should ask for, not as the point — and with them the whole
sixteen-run table went back to bit-identical digests.

The general rule: a cap on a controller's OUTPUT is a property of that
controller's gains. Sharing it with a threshold in another layer couples two
numbers that move for unrelated reasons, and the coupling only shows up the
day the other one moves. If a loop's cap must stay clear of an engine
threshold, assert that (`cap < gate`) rather than aliasing it.
