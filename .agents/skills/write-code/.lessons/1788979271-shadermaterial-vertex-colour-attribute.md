---
title: In a three ShaderMaterial the vertex colour is declared by three, as vec4 only when the geometry's colour attribute has four items — never redeclare it, and give every geometry sharing the material the same width
date: 2026-09-09
scope: pwa/src/game/water-shader.ts, pwa/src/game/water-mesh.ts
concepts: [three, shader, attributes]
---

With `vertexColors: true` three prefixes the vertex shader with
`attribute vec3 color`, or `attribute vec4 color` when the geometry's
`color` attribute has `itemSize` 4 (its `vertexAlphas` program
parameter). Declaring it again in the source is a compile error, and the
width is part of the program cache key: two meshes sharing one material with
a 3-wide and a 4-wide colour attribute compile two programs and the shader
reads `color.a` as 1 on one of them. The water carries its foam share in the
fourth channel, so BOTH grids' attributes are 4 wide even though the far grid
never foams. Three's fog chunks (`fog_pars_vertex` / `fog_vertex` /
`fog_pars_fragment` / `fog_fragment`) need `fog: true` on the material and
the uniforms cloned in from `UniformsLib.fog` — which carries `fogDensity`
too, so a "every uniform is read" test has to allow it. `cameraPosition` and
`modelMatrix` come for free.
