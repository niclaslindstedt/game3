---
title: A picture lever that changes what a shader READS is a uniform branch, not a third shader build — and OFF is two halves (the pass and the read) that must agree
date: 2026-09-10
scope: pwa/src/game/water-shader.ts, pwa/src/game/wake.ts, pwa/src/game/renderer.ts, pwa/src/game/settings-video.ts
concepts: [options, video, shader, uniforms, wake, performance]
---

The WAKE lever (`WAKE_LOOK`) skips texture reads in the water shader — the
relief's four gradient reads per vertex and per pixel, the map read, the
road's two foam samples. It is one float uniform (`uWakeMode`) and `if`s on
it, not a compiled variant: every pixel of a frame takes the same branch, so
the branch costs nothing, where a variant per stop would recompile the
water on the press (a stall the SKY row already pays because its loop bound
has to be a literal). Reserve compile-time variants for loop bounds and
declared uniforms; everything else on a picture row is a uniform.

OFF for a map-fed effect is two settings that have to agree — `wake.setDrawn`
(no pass) and `water.setWakeLook` (no read) — and `renderer.setVideo` sets
both from one row. The pass clears its target ONCE on the way out (`dirty`)
so a later press back on never reads a stale road; the trail is still
SAMPLED while off, so what comes back is the road actually laid.

Measuring it: `make profile` cannot see a per-pixel lever at all — draws and
tris do not move for a texture read skipped, and its cpu/fps columns are the
software rasterizer's (a 4 s window at DETAIL high is two frames, and one
slow one reads as 37 ms against 15). Count the reads in the shader source and
LOOK: `screenshot.mjs --scene cruise --detail low` beside the default is the
proof, and on seed 38 the dealt sky is already rain, so the RAIN lever shows
without `--weather`.
