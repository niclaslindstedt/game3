---
title: Aero is ~12 % of the drag at the top of the range, so a cdA change is worth ~7 km/h per 100 % — judge it INTO A HEAD WIND or you will not see it at all
date: 2026-09-11
scope: engine/game/flight.ts, engine/game/defs/craft.ts, engine/game/defs/tuning.ts
concepts: [aero, drag, top-speed, tuning, measurement, wind]
---

A personal watercraft is stopped by the WATER. At the skiff's 95 km/h the
aero term is about 320 N against a total the pump is holding up in the
thousands, so on the flat bench the whole roster moves about **7 km/h per
100 % of `cdA`** — an 18 % cut is 1.0–1.1 km/h, and 0–50 km/h does not move
at all (the air is a few per cent of the drag down there and the hump is all
of it). A benched calm-water figure is therefore the WRONG instrument for an
aero change: it will read as noise and tempt you into inflating the
coefficient until it is no longer a measurement.

The right instrument is a HEAD WIND, because the drag is on the CLOSING
speed squared. The same 18 % on the same skiff: +1.0 km/h of ceiling calm,
+1.7 into 14 m/s, and the 70 → 90 km/h stretch falls from 29.4 s to 13.8 s.
Stage it by passing `wind: { from: <the heading ridden>, speed }` to
`createGame` — the level's own wind is whatever the seed dealt and is rarely
on the nose.

So: quote any aero change at three winds (calm, ~8 m/s, ~14 m/s), and quote
the time across the TOP of the range rather than the ceiling — the ceiling
moves by a km/h and the sprint to it halves, and the second number is the
one a rider feels.
