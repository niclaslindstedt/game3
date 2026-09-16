---
title: Dropping the gate look-ahead moved neither `make sim` nor `make ride` by a byte — the bot never rode out of order, so an ordering rule is free to tighten
date: 2026-09-16
scope: engine/game/course.ts, engine/sim/bot.ts
concepts: [gates, course, bot, simulation, determinism]
---

`stepCourse` used to take the FIRST of the owed gate and the next
`TUNING.course.lookAhead` = 3 that a move went through, charging the ones
skipped. Making the owed gate the only takeable one — a checkpoint is valid
only in its turn — left `make sim`'s whole table, digests included,
byte-identical, and `make ride` with it.

That is worth knowing before the next ordering change, and it is not
obvious: the bot aims `aimPoint` (the owed gate) every step, so it only
ever crosses gates in order; the look-ahead was recovery for a HUMAN who
had ridden past one, and no bot run in the corpus ever spent it. Read a
zero diff here as confirmation the rule is course-logic only, not as a
sign the lab did not run.

The stall the look-ahead existed to prevent is covered twice over without
it: crossing the owed gate's own plane wide is charged there and then and
makes the next one live (so going wide never blocks), and `resetPose`
stands the craft behind the gate `nextGate - 1` facing the one owed (so a
rider somehow beyond a gate whose plane they never crossed always has a
way back). Neither needed changing.
