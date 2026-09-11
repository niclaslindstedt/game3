---
title: Anything standing in the open ocean is quoted as a RATIO, because STORM_CEILING goes as the SQUARE of the speed class
date: 2026-09-11
scope: engine/game/ocean.ts, engine/game/tornado.ts, engine/game/defs/tuning.ts
concepts: [ocean, tuning, storm, speed-class, calibration]
---

`STORM_CEILING` is `jumpableHs(topSpeed)`, quadratic in `TUNING.pump
.speedClass`: 3.5 m at ×0.5, 14.2 at ×1, 226 at ×4. A feature placed out
there and quoted in metres or m/s is therefore correct at exactly one class.

Two traps, both found by sweeping the class out-of-process (`pinSpeedClass`
cannot help — `STORM_CEILING` and anything derived from it is a module-level
const fixed at import):

- **A threshold that depends on a CRAFT does not scale.** The air speed at
  which a hull hovers in an updraft is √(mg / ½ρA·Cd) — mass over plan area,
  34–38 m/s across the roster, independent of class and sea. An updraft
  quoted outright therefore sits UNDER it at a low class and lifts nothing:
  no test fails, the feature just stops existing. Quote the margin (the
  climb) and add each hull's own threshold to it.
- **Pick the quantity a player reads.** Column height quoted against the
  ceiling goes as class² and gave 5 m at ×0.5 and an 80 m / 30 s hang at ×2.
  Air TIME is what reads, so quote the height in seconds of climb — linear in
  the class while the sea around it is quadratic.

And cap any force that goes as a relative speed SQUARED: a hull falling into
a rising column adds the two speeds and is flung back up (44 s of air at ×4).

Sweep at ×0.5, ×1 and ×2 before believing a number out there.
