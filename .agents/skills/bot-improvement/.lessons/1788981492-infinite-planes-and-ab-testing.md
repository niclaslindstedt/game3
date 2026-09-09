---
title: A gate's plane is infinite — "past the plane" stops meaning "behind me" the moment the course has corners; and A/B an addition by deleting it before keeping it
date: 2026-09-09
scope: engine/sim/bot.ts, engine/game/course.ts
concepts: [gates, aiming, corners, measurement]
---

Two things a winding course (R22) taught, and the second one saved more code
than the first one fixed.

**The plane.** Both the bot's "which gate am I riding for" and the engine's
own miss rule read a gate as passed by comparing against its plane. A plane
runs off across the whole level, so a craft two hundred metres BEFORE a corner
is already past the plane of the gate after it. The bot's rule then said "past
both, go back for the nearer", which is a widening spiral out to sea until the
run times out; the engine's rule said "neither crossed", which deadlocks a
rider who misses two gates in a row. The bot now walks FORWARD only
(`rideFor`), and the engine charges a gate whose line was crossed outside the
buoys within `TUNING.course.missWide` of its centre.

**The A/B.** Fixing the spiral, a whole pursuit-along-`course.path` was added
first — `stationOf`, `pointAt`, `followPath`, a sounding of the bed, five
profile knobs. `make sim` with it and without it is IDENTICAL: the bot already
reads the shoal ahead and steers off it (`shoalAhead`/`shoalDepth`). Delete a
bot addition and re-run the sweep before keeping it; on a 16-run sweep that
costs a minute and it is the only way to tell a fix from a passenger.
