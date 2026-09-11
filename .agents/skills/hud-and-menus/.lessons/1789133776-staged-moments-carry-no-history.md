---
title: A readout with a THRESHOLD photographs as empty in a staged scene, because `placeRun` stands a moment with no history behind it
date: 2026-09-11
scope: pwa/src/game/scenarios.ts, engine/game/place.ts, pwa/src/game/hud.tsx
concepts: [screenshots, hud, staging, verification]
---

The air clock only starts once a flight has lasted `flight.airCounts`
(0.5 s), and the first `make screenshots SCENE=apex` after that change came
back with no clock at all: a staged flight begins the instant it is stood,
so the hull at the top of its arc had been "in the air" for 0.01 s. The
readout was right; the moment was a lie, and a session reading only the
picture would have concluded the gate was broken.

Any readout gated on accumulated state — time in the air, a streak, a count
since something — has the same hole, because `placeRun` stands a pose, not a
history. The fix is to give the moment the history: `RunMoment.airTime` says
how long the hull has ALREADY been up, and the apex scenario stands its
flight a second in. Add the field the readout needs rather than lowering the
threshold to suit the harness.

So when a HUD change adds a threshold, check the scene that photographs it
can still reach past it, and shoot BOTH sides — `SCENE=launch` (under the
line, nothing drawn) and `SCENE=apex` (over it) — because a picture with
nothing in it looks the same either way.
