---
title: A PointsMaterial with sizeAttenuation off sizes in DRAWING-BUFFER pixels, so a fixed size is a different ANGLE at every stop of the RESOLUTION row — size it as a share of the buffer height
date: 2026-09-11
scope: pwa/src/game
concepts: [points, sprites, glare, resolution, renderer, effects]
---

`THREE.Points` with `sizeAttenuation: false` is the right primitive for
glare — a light on the eye is a roughly constant ANGLE, so a lamp at 300 m
should stay the same size and only get dimmer — and it draws any number of
lamps in ONE call where a `Sprite` each is one call each.

The trap is the unit. three's point shader writes `gl_PointSize = size`
directly, and `gl_PointSize` is in DEVICE pixels of the drawing buffer. The
buffer here is `renderer.setPixelRatio(dpr)` × the CSS size, and the
RESOLUTION row moves that dpr — so `size: 26` is 26 CSS px at dpr 1 and
9 CSS px at dpr 3. The glare silently shrinks to a third of its angle at the
top of the row, which reads as "the lamps stopped working on my machine".

Size it as a share of `renderer.getDrawingBufferSize().y` instead, and give
the module a `setLens(height)` the renderer calls from the same block that
already feeds `spray.setLens` — that block runs on every resize, because the
resize handler clears `fovWas`.

Brightness is the other half: `PointsMaterial` takes ONE size but per-point
`vertexColors`, so range dimming and on/off go in the colour attribute and
nothing needs a custom shader (and so nothing has to re-close the
`colorspace_fragment` loop by hand). Keep `depthWrite: false` with depth
TEST on: the glare then lies over the sea and is still hidden by a headland.
