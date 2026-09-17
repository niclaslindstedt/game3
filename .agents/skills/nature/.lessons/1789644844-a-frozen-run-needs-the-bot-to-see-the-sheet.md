---
title: Anything that becomes ground at run time needs the bot's shoal probe to read it, or `make sim` grounds forty times a run on a seed dealt that season
date: 2026-09-17
scope: engine/sim/bot.ts, engine/game/ice.ts, engine/game/ocean.ts
concepts: [ice, bot, sim, grounding, season, r37]
---

R37's sheet is ground to the hull through `bedAt`, but the bot's "reading the
water" probe reads `level.ground` directly and steers SEAWARD off a shoal — and
on a frozen run the sheet stands on both sides of the channel, so seaward is
deeper into the ice. The first arctic sim table had seed 2 (dealt winter)
failing for all four craft with 48–234 groundings and 40 resets, while every
other seed finished; the tell is a `maxHs` of 0.18 beside 1.3 on the others.

The fix is in the bot, not the ice: read `iceAt` FIRST at the same probe point,
and turn the bow down the ice field's own gradient (toward the channel) with an
`iceMargin` short of the brash. It is `-Infinity` on every run with no ice, so
no taiga digest moves. The general rule: when a season, a mode or a run option
puts new ground under a level, `make sim` on a seed dealt that condition is the
check — the corpus tests never deal it, and a bot that cannot cope is a race
field that cannot either.
