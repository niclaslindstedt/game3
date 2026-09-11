---
title: On a shore scene the reflection pass is about HALF the frame's draw calls and triangles — it is the biggest single lever on the water, and `make profile` measures it directly
date: 2026-09-11
scope: pwa/src/game/reflection.ts, pwa/src/game/settings-video.ts
concepts: [reflection, mirror, profile, performance, options]
---

Measured on the built site with `make profile` (seed 38, the lab's four scenes,
software rasterizer — draws and tris are hardware-independent, so judge on
those):

| cruise | draws | tris |
| --- | --- | --- |
| mirror OFF, everything else low | 68 | 638k |
| mirror SHARP, water grid HIGH | 126 | 1.12M |

`rest` is the same story (68/614k against 126/1.09M) and `launch` roughly halves
too. The mirror is a second drawing of the coast from under the surface, and on
this taiga shore the wood is most of the triangles in it — so the reflection
lever moves the frame further than the water grid's own three stops do.

Two consequences. When a picture row is meant to buy frames on the water, the
mirror has to be on it or the row barely registers. And when reading a profile
diff on anything else in the sea, check the mirror's stop first: a 500k-triangle
swing between two runs is the reflection pass toggling, not whatever was edited.

`CHROMIUM_PATH=/opt/pw-browsers/chromium` and `npm install --no-save
playwright-core@1` are both needed in a web session, or the lab prints its STUB
text and exits zero — which reads as a lab that ran.
