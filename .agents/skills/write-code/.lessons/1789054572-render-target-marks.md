---
title: A pass that rasterises marks into a render target through three needs a double-sided material, no camera transform, and a diagnostic that paints the target's raw channels
date: 2026-09-10
scope: pwa/src/game/wake.ts, pwa/src/game/reflection.ts
concepts: [three, render-target, blending, shader]
---

Writing data (not colour) into a `WebGLRenderTarget` with a
`ShaderMaterial`: put the plan position straight into clip space off a
box uniform and ignore three's camera (any camera will do for
`renderer.render`, with `frustumCulled = false` on the meshes), leave out
`colorspace_fragment` so the bytes are the bytes, and blend with
`CustomBlending` + `OneFactor`/`OneFactor` for additive marks (an
unsigned target clamps a negative fragment to 0, so carry a signed value
as two channels, up and down). `side: DoubleSide` is not optional: the
winding of a strip laid in plan depends on which way it runs, and
single-sided the pass silently draws nothing. Read the target back by
painting `texture2D(uMap, uv).rgb` straight to the screen in a scratch
build before believing any tuning — the picture cannot distinguish "the
effect is too weak" from "the map is empty".
