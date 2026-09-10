---
title: "`wy` is the rate about the hull's own mast, not about the world's vertical — and a leaned-over hull reads its roll as yaw"
date: 2026-09-09
scope: engine/sim/bot.ts
concepts: [steering, bot, waves, damping]
---

The bearing loop's damping term was `wy · min(yawLead, eta)`. `wy` is the BODY
yaw rate, and a hull leaned 20° over on a wave face has its mast pointing
sideways, so part of the roll rate reads there as a yaw rate that is not one.
On flat water it barely shows. In a metre and a half of sea it saturated the
term on its own and put the nozzle hard over twice a second on a straight — a
trace of the approach to a ramp showed `steer` alternating ±1.00 at about 1 Hz
while the throttle was pinned open.

The fix is the world-frame reading: `rotate(q, {wx, wy, wz}).y`. On the sweep
it moved every column the right way (227→238 gates taken, 30→28 resets, 20.6→
21.4 km/h on the slowest run). It costs one buoy on `tests/simulation_test`'s
skerries fixture, which the hull now passes a metre outside at 78 km/h and
pays for rather than looping back to.

**Do not retune `yawLead` to win that buoy back.** The two readings have the
SAME mean magnitude over a run (0.260 against 0.263 rad/s) and differ only in
the peaks, so there is no scale factor to derive — every yawLead in
0.4…1.2 was tried and none makes all the fixtures green at once. That is the
"fitting the constants to the assertions" trap this skill's other lesson
already names.

**And the A/B that did NOT survive.** A rider leans back when the bow buries,
so the bot got the same: `lean = 1` above a `submergedDepth` bar. Three bars
(0.2 / 0.35 / 0.6 m) and two air pitches, and every one was WORSE than
deleting it (232 against 238 gates, more misses). Deleted. The dives it was
aimed at come from meeting a head sea at pace, and a lean applied after the
bow is already in is too late to be the answer.
