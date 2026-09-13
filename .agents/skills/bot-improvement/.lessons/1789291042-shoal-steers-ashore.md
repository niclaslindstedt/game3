---
title: The bot's shoal override steers it ONTO the beach when a gate it still owes lies across a headland
date: 2026-09-13
scope: engine/sim/bot.ts
concepts: [bot, shore, groundings, gates, measurement]
---

`botInput`'s shoal reading probes `shoalAhead` seconds down the CURRENT
heading and, when the bed there is shallower than `shoalDepth`, replaces the
steer with a turn toward the offshore field's gradient. Where the gate it is
riding for sits across a spit, that override does not save it: the bot rides
from 70 m offshore to 15 m inland in six seconds and beaches, and only the
idle reset recovers it.

Two things that look like fixes and are not, both measured over ten seeds and
four craft: looking FURTHER ahead makes it worse (`shoalAhead` 2.6 → 3.6 → 4.4
took groundings 36 → 40 → 70, because more of the approach is spent under the
override), and skipping a gate whose straight line crosses land — sampling
`level.offshore` along it — barely moves them (36 → 46). The aim is not the
problem; the override's own steering is.

It stays rare while the engine clears a gate the rider went WIDE of, because
then the bot is never left owing a gate behind a headland. Anything that makes
a gate stick until it is threaded (`TUNING.course.lookAhead`) makes this the
bot's commonest failure: groundings over 40 runs went 1 → 8 on the course
geometry alone and 8 → 25 once a gate had to be threaded to count. Read it off
`make sim`'s groundings column, and trace it by logging the craft's
`sampleField(level.offshore, x, z)` each second — the number walks steadily
negative rather than jumping.
