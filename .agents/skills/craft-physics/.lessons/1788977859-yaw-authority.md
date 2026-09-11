---
title: Turn authority is a yaw-torque BALANCE against the hull's own weathervane — and the weathervane is NOT the knob
date: 2026-09-09
scope: engine/game/craft.ts, engine/game/defs/tuning.ts
concepts: [steering, carve, yaw, nozzle, tuning]
---

Benched flat (SKILL.md's flat bench — `SCENARIO=carve` rides a real sea and
cannot show a turn), full lock and full throttle, decompose it. At steady
state the driving terms (the nozzle's `T·sinδ·lever`,
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
