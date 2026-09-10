---
title: An in-craft camera is placed against the RIDER's pose, not against the hull — and he tucks forward at speed, so a lens at his eye height ends up behind his head
date: 2026-09-10
scope: pwa/src/game/camera-rigs.ts, pwa/src/game/rider-pose.ts
concepts: [camera, rider, cockpit, framing]
---

`camera.ts` is three-free and cannot read `cockpitOf`, so the two bolted-on
rigs' offsets are hand-authored body metres from the cog and have to be
verified by LOOKING. The trap is that the rider is not static: `rider-pose.ts`
tucks him forward as pace rises, so an eye placed at his head's resting
position is inside his chest at rest and behind his head at 60 km/h — the
frame is then his shoulders and forearms hanging over the top of the picture,
which reads as a rendering bug rather than as a camera one.

What worked on the skiff (length 3.1 m, cog near mid): `nose` at up 0.95,
forward 0.72 — over the bar and clear of his tuck, with the grips and his
forearms framing the bottom sixth; `bow` at up 0.62, forward 1.15 — on the
foredeck, the deck's point at the bottom of the frame. Half a metre lower on
`bow` and the near water mesh draws over the deck and the hull's chines cross
the frame as stray lines.

Verify at `SCENE=carve`, not `rest`: the tuck is a function of speed and the
rest pose hides the whole problem.
