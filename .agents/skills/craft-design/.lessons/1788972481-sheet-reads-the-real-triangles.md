---
title: A lab can read the builder's exact triangles — three.js geometry loads in plain Node under aliasEngine, so never restate a silhouette in a script
date: 2026-09-09
scope: scripts/craft-preview.mjs, pwa/src/game/craft-body.ts
concepts: [craft-sheet, tooling, three]
---

`craft-body.ts` imports `three`, and that is fine for a Node lab: three's ESM
build makes `BufferGeometry`, `Color` and `Vector3` without a DOM or a WebGL
context, so `scripts/craft-preview.mjs` imports the builder through
`aliasEngine` and walks `geometry.getAttribute("position")` for the same
triangles the renderer draws. Painter's sort along the look direction, cull
faces turned away, shade by the face normal — a few dozen lines and no
browser. The alternative — a second hand-drawn silhouette (the ride lab's
`hullSide` is one, a stand-in) — is a drawing of what somebody remembered the
craft to be, and it drifts the day the builder changes. Read the geometry.
