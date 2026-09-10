---
title: A GLSL array uniform slips past a regex written for scalars — `tests/water_shader_test.ts`'s parser is the one that has to learn, not the shader
date: 2026-09-10
scope: pwa/src/game/water-shader.ts, tests/water_shader_test.ts
concepts: [shader, tests, uniforms, water]
---

`tests/water_shader_test.ts` holds the water's uniforms to two rules: every
one the shader declares is carried, and every one carried is read. It found
the declarations with `/uniform\s+\w+\s+(\w+)\s*;/`, which does not match
`uniform vec3 uBuoyPos[4];` — so an array uniform was carried, uploaded and
never seen by either check, and the failure it produced ("expected […] to
include 'uBuoyPos'") pointed at the shader rather than at the parser.

The regex now takes an optional `[…]`. Worth knowing before adding any
array uniform: the test is the only thing standing between a bundle that is
uploaded every frame and a bundle nothing reads.

Two more things about array uniforms in this tree: size them from a
TypeScript constant interpolated into the source (`uniform vec3
uBuoyPos[${N}];`) so the length is stated once, and give three an array of
`THREE.Color`/`Vector3` objects as the uniform's value — it flattens them
per frame, and mutating the objects in place is what a per-frame setter
should do rather than replacing the array.
