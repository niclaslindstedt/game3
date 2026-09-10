---
title: Every depth in the fauna model is measured down from the water over the POD, never from y = 0 — a fin that clears mean sea level clears nothing
date: 2026-09-10
scope: engine/game/fauna.ts, pwa/src/game/fauna.ts
concepts: [fauna, water, waves]
---

The first version of the surfacing model put an animal's back a few
centimetres over `y = 0` and called it a sighting. It is not one: a level's
sea is Hs 0.5-1.5 m, so for half of every wave period that back is a metre
UNDER the actual surface, and the fin nobody saw was the whole feature. The
same bug the other way round put a school holding 0.8 m down into the AIR
over every trough.

The fix is one argument: `faunaPose(pod, i, t, out, waterY)`, where
`waterY` is `surfaceAt(sea, level, pod.x, pod.z, t).height`. Sample it once
per POD per frame in `pwa/src/game/fauna.ts`, not per animal — a pod's loop
is a dozen metres across and the swell it rides is fifty, and per-animal
would multiply the hottest wave sum in the renderer by the school size for
nothing.

Two consequences worth knowing before touching this again:

- `WaterMesh.seeThrough` has no authority over an animal that is OUT of the
  water. It is how far you can see INTO the sea; a fin standing over it is
  against the sky. Cull a surfacing animal on a much longer range and pick
  which by geometry (`pose.y + finTip > waterY`), not by "is it mid-rise".
- State how far up an animal comes as a DEPTH in body radii (`awash`, about
  1) rather than a height. One radius down puts the back awash and the
  dorsal — and only the dorsal — clear, which is what a sighting at sea
  looks like. A value that lifts the centreline above the water shows the
  pale flank and belly, and a killer whale rolling on its side reads as a
  white blob.
