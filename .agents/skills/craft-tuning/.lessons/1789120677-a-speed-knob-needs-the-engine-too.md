---
title: A global speed knob has to scale the ENGINE as well as the gearing — pitch alone makes the roster SLOWER, and the class must be quoted in the speed it buys, not the pitch
date: 2026-09-11
scope: engine/game/propulsion.ts, engine/game/limits.ts, engine/game/defs/tuning.ts
concepts: [tuning, measurement, performance, craft]
---

`TUNING.pump.speedClass` is the kart-game class knob. Two things it took to
make it work, both found by measuring:

**Pitch alone bogs.** Scaling `jetVelocity` makes the jet faster, but the
pump's LOAD torque goes as pitch³ at a given shaft speed, so the engine revs
lower against it. Measured, the dart went 78 → 51 km/h as the class went
1 → 2. The class has to scale `curveTorque` by the cube of the pitch too —
a bigger engine AND taller gearing, which is what an engine class is.

**Quote it in what it buys.** With both halves in, speed ∝ pitch^1.2, not
pitch: a planing hull lifts as it speeds up, its wetted area shrinks and its
drag grows slower than v². Exposing the raw pitch as the knob makes 1.5 mean
1.66× — so the knob is the SPEED multiple and the pitch behind it is
`class^(1/1.2)`. Then `topSpeedOf(spec) = spec.topSpeed · class` is exact by
construction and everything downstream (the bot, the HUD, a derived wave
ceiling) can trust it. Measured after: promised vs achieved within 2–4 %
from class 1 to 2.

**Every absolute number in a test is a class-1 bound.** `accel0to50`
(falls as class²), `powerKw` and the torque curve, the idle creep, the
astern pace, the static-pull-over-weight band — all of them. So is the
drag strip's LENGTH: at class 1.5 the craft ran off the end of the
synthetic level and out into the open ocean, and reported a hull that was
not planing. Fixtures whose subject is not the roster's pace (the camera
rod, the rider's springs, a righting hull) pin the class instead.
