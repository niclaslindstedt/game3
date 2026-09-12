---
title: A GLSL reserved word compiles nowhere and the failure reads as the SEA MISSING, not as a shader error
date: 2026-09-12
scope: pwa/src/game/water-shader.ts, pwa/src/game/water-foam.ts, pwa/src/game/sky-glsl.ts
concepts: [shader, water, debugging, screenshots, three]
---

Naming a local `float patch` in the water's fragment shader is legal
TypeScript, legal-looking GLSL, and refused by every driver: `patch` is one of
the words GLSL ES reserves without using (`sample`, `filter`, `common`,
`active`, `input`, `output`, `this`, `long`, `half`, `packed`, `partition`,
`row_major`, `subroutine`…). Nothing fails at build time, nothing fails in
`make lint`, and nothing fails in `make test`.

**What it looks like is the fault worth knowing.** A `ShaderMaterial` whose
fragment shader will not compile does not draw a broken sea — it draws NO sea:
`make screenshots` comes back with the sky dome running to the bottom of the
frame, the craft floating in it, and the lamp pool gone. It reads as a renderer
regression somewhere else entirely (the mesh, the grid, the cull), and a
session can spend a long time in `water-mesh.ts` before looking at the shader.

The message IS there: the page logs `THREE.WebGLProgram: Shader Error … ERROR:
0:519: 'patch' : Illegal use of reserved word` with the offending lines quoted,
and `scripts/screenshot.mjs` forwards console output. Piping its output through
`grep previews` hides it. **When a lab's picture is missing something big, read
the lab's whole output before reading any source.**

`tests/water_shader_test.ts` now scans both shaders for the reserved list with
comments stripped, so this particular one cannot come back.
