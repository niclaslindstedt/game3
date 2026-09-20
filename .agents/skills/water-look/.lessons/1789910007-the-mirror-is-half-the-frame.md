---
title: The mirror is about HALF a shore frame's draws and triangles, and its bill is SUBMISSION — so cutting how much coast goes into it does nothing; the levers are the cover's share and the pass's CADENCE
date: 2026-09-11
scope: pwa/src/game/reflection.ts, pwa/src/game/settings-video.ts, pwa/src/game/renderer.ts
concepts: [reflection, mirror, profile, performance, options, flora]
---

Measured with `make profile` on seed 38 (draws and tris are hardware-free;
`cpu ms` and `fps` are SwiftShader and mean nothing): `cruise` goes 120 → 68
draws and 797k → 462k triangles with the mirror off, and `rest` and `launch`
tell the same story. It is the biggest single lever on the water. Two standing
consequences: when reading a profile diff on anything else in the sea, check
the REFLECTIONS stop first — a 300k-triangle swing between two runs is the
mirror toggling, not whatever was edited; and `--detail low` beside it splits
the pass between the wood and the chunks under it (still 48 draws and 224k
triangles with the cover sparse, so the shore's own geometry is over half).

The obvious way to make a cheap mirror is to draw less coast into it. **It does
nothing.** The shore is built in 256 m chunks (`terrain.ts`'s `CHUNK`), so a
chunk's bounding sphere reaches ~181 m past its centre and `cullByDistance` is
conservative at the edge — by the time a radius is short enough to drop a
chunk, the mirrored lens's own frustum has already dropped it. Measured at
60 m, 120 m and 250 m of mirrored shore: the same 113 draws and 636k triangles
at all three.

What pays:

- **The pass's cadence.** Drawing it every other frame halves it outright, and
  it is the only lever that takes DRAW CALLS off the mirror rather than just
  triangles (113 → 89). Safe because the picture is read blurred off moving
  water — but freeze the matrix and the mirrored frustum WITH the texture, or
  the reflection slides across the sea by whatever the camera did meanwhile.
- **The cover's mirrored share** (`ReflectionLook.scale`, applied in
  `flora.ts`), which is where the triangles are: 797k → 636k from 0.4 → 0.18.
