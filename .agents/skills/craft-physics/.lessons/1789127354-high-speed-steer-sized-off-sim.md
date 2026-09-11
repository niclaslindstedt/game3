---
title: High-speed turn authority has its own dial (`pump.steerHighSpeed`) — the flat bench sizes it, `make sim` settles it, and the docs' old tables are not a baseline
date: 2026-09-11
scope: engine/game/craft.ts, engine/game/defs/tuning.ts
concepts: [steering, yaw, nozzle, tuning, measurement, sim]
---

"It is too hard to steer at speed" is geometry, not the pump: a turn rate is
a/v, so the same nozzle force swings a hull half as fast at twice the speed.
`carve` is the wrong lever for it — it is roll-driven and lifts every speed,
eroding the "throttle IS the steering" ratio `craft_test` holds.
`pump.steerHighSpeed` instead scales everything the nozzle is worth (the side
thrust and `keelYaw`) by `1 + k·(v/topSpeedOf)²`, so the bottom half of the
range does not move.

It is SUB-LINEAR: on the flat bench 0.35 buys a tenth more turn at 0.95 of
top speed, and another 0.1 on the dial buys about 2 % more, because most of
the yaw up there is already the hull's own. So the bench cannot pick the
value — `make sim --seeds` over eight seeds can: at 0.35 every craft's pace
rises and the resets halve; at 0.45 the paces fall back and the bot starts
grounding, because a tighter line puts it on the shore. Widen past the
default four seeds before reading a footer that small.

Two measurement traps. Get the BEFORE by setting the new dial to 0
in-process (`TUNING.pump.steerHighSpeed = 0` in a scratch probe) rather than
stashing the tree — one run, no rebuild, and it proves the change is
separable. And do not treat the measured tables in `docs/riding.md` as the
baseline: the full-lock numbers there were a quarter stale before this pass
(skiff 1.74 rad where the code gave 2.19), so re-measure at dial 0 or the
delta you report is somebody else's drift.
