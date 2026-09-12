---
title: A near-vertical lens builds its frame out of the little run between lens and aim — so swing and look-through must be ZERO, not small
date: 2026-09-12
scope: pwa/src/game/camera-rigs.ts, pwa/src/game/camera.ts
concepts: [camera, framing, ladder, drone]
---

`renderer.ts` poses the lens with `camera.lookAt(aim)` and a world up vector,
so the frame's own up is whatever is left of the horizontal run from the lens
to its aim point. On every boom rig that run is metres long and a metre of
lateral swing nudges the framing. On a rig standing straight over the craft it
is the ONLY thing defining the frame, and the same metre rotates the whole
picture.

So the `drone` row zeroes `swing`, `swingMax`, `lookThrough` and
`lookThroughMax` outright, and keeps `dist` at 0 with a 2.5 m `aimAhead` at
18 m up — about 8° off the vertical. That lead is deliberate and load-bearing
twice over: it is what puts the craft's nose reliably up the frame, and it
keeps `lookAt` off the degenerate case where the view axis is parallel to world
up and three.js has to perturb its own basis to build a frame at all.

`flight` is 0 for the same geometry: the rod is `dist` long, and rotating a rod
of no length onto a flight path only moves the lens sideways.

What is left as a rule for any new rig that looks steeply down: **if the plan
distance between lens and aim is smaller than the lateral terms acting on
either of them, the shot does not pan, it spins.** Measure it —
`tests/camera_test.ts`'s drone block asserts the off-vertical angle stays
between 2° and 12° and that the aim's bearing is the craft's heading.
