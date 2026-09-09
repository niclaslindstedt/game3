---
title: The bot's steering loop is the CEILING on how hard the hull may be allowed to turn — past about a g it weaves, and neither of its two gains fixes that
date: 2026-09-09
scope: engine/sim/bot.ts
concepts: [steering, bot, tuning, gates, simulate]
---

Raising `hull.carve` so a committed turn pulls ~1 g put the bot into a limit
cycle: it rode a straight line of gates at full lock, swinging ±20° of
heading, and blew past one. A full grid over `steerGain` (1.4…2.2) ×
`yawLead` (0.4…0.85) at that authority found only two pairs that keep
`simulation_test`'s two synthetic-shore cases green, and BOTH cost the
aggregate badly — unfinished runs, three to four times the resets — against
the pair that fails one case on a single gate. Fitting the constants to the
assertions makes the instrument worse everywhere else. The honest resolution
was to back the physics off to the authority the loop already rides cleanly
(~0.88 g) and say so in `TUNING.hull.carve`'s comment; going further is a
change to BOTH in one pass.

The one structural improvement that did help: the damping term is a LEAD
TIME, not a gain — `wy · min(yawLead, eta)` with `eta` the time to the aim
point at the current speed, `yawLead` = 0.7 s. A constant cannot tell a buoy
two seconds away from one two hundred metres away. It is the same
anticipation the ramp-axis pursuit already had in `axisSettle` and the
bearing loop simply lacked.

Two things about measuring any of this. The 4 seeds × 4 craft aggregate is
VERY noisy — one missed gate cascades into a recovery loop that swings pace
by 20 km/h — so read the slowest single run and the unfinished count beside
the totals, never the totals alone. And a grounding in the table is usually
not a steering failure: trace it and it sits inside a recovery loop the bot
entered after losing a gate somewhere else entirely.
