---
title: Turn authority is a yaw-torque BALANCE, and `make ride SCENARIO=carve` cannot show it — bench the steady turn on a flat synthetic level instead
date: 2026-09-09
scope: engine/game/craft.ts, engine/game/defs/tuning.ts
concepts: [steering, carve, yaw, nozzle, tuning]
---

`SCENARIO=carve` rides a REAL sea: at speed the hull is airborne a fifth of
the steps and `planing` collapses under half, so the strip shows a chaotic
mix and not the turn. A claim about how hard the game turns is made on a
flat bench — `syntheticLevel({ windSpeed: 0.01 })` with `sea: { hs: 0.01 }`,
full lock and full throttle, averaged over the last seconds of a ten-second
run — read as yaw rate, radius `v/wy`, lateral g `wy·v/9.81` and the time a
180 takes. Quote g and the 180: a radius alone hides that the craft also
accelerated.

Then decompose. At steady state the driving terms (the nozzle's `T·sinδ·lever`,
`pump.keelYaw`, `hull.carve`) balance against the hull's own weathervane
moment — the lateral drag centre sitting aft of the CoG — plus
`hull.rotDamp.y`. The weathervane is far the biggest and is NOT the knob:
it is the same lateral force that makes the turn, so cutting it makes the
hull skate instead of carve. The knobs are `carve` (the arcade dial, and the
one that decides how hard the game turns, because the nozzle's moment fades
as `V_in` approaches `V_j`) and `rotDamp.y`.

`rotDamp.y` shipped at 650 against 300 in pitch, which the geometry says is
backwards: a yawing hull sweeps only its lateral profile (length ×
immersion), a pitching one sweeps the whole bottom (length × beam). Order
that axis smallest of the three.

Guard rails when raising `carve`: it needs no thrust, so it erodes the
"throttle IS the steering" ratio `craft_test` holds, and `craft_test`'s
4-second sweep breaks silently if a craft turns past 180° (angleDiff wraps
and the heading assertion reads negative).
