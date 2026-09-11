---
title: The bot's air PD has to be tuned AGAINST the arcade landing assist — a stiff hold buys the levelling twice and costs pace and dives
date: 2026-09-11
scope: engine/sim/bot.ts
concepts: [bot, air, tuning, simulate, assist]
---

`flight.ts`'s landing assist folds away in proportion to the `lean` it is
handed, and the bot's air PD writes `lean` on every airborne step. So the
harder the bot holds an attitude, the less of the assist it gets, and it
ends up paying for the whole correction itself.

Swept over ten seeds and four craft after the assist landed: the shipped
`airPitch` 0.08 on gains 2.5/0.9 gave 40.9 km/h and 34 dives; 0.04 on
2.0/0.7 gave 43.5 km/h and 20 dives, with every cell of the 0.04 row
beating every cell of the 0.08 row, so it is a gradient and not one lucky
sample. Aim FLATTER and hold it LOOSER than a bare hull wants.

The general rule: any assist that reads a rider input as consent is coupled
to whatever writes that input, and the bot is one of those writers. When an
assist is added or its strength moved, re-sweep the bot's loop that shares
its input before believing any balance column — `make sim`'s pace order
shifting after an assist change is usually this, not the craft.
