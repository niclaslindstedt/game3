---
title: A graft onto one of three's own materials hooks its CHUNK NAMES, and a test can run the graft over `THREE.ShaderLib` in Node — but the picture is judged by writing the terms into the colour channels, never by arithmetic
date: 2026-09-10
scope: pwa/src/game/craft-surface.ts, tests/craft_surface_test.ts
concepts: [three, shader, grafts, debugging, materials]
---

`craft-surface.ts` keeps three's whole Phong pipeline (both lights, fog, the
flat-shaded derivative normal) and grafts the sky mirror on through
`onBeforeCompile`, replacing `#include <envmap_fragment>` and hooking
`<common>`, `<begin_vertex>`, `<project_vertex>` and
`<specularmap_fragment>` by name. Three facts the graft leans on, checked
against `node_modules/three/src/renderers/shaders`: `vViewPosition` is
`-mvPosition`, so `normalize(vViewPosition)` is the view vector three's own
lighting uses; `normal` is in scope after `normal_fragment_begin` and is the
face normal under `flatShading`; `inverseTransformDirection(dir, viewMatrix)`
is the view→world the envmap chunk itself uses. Shared uniforms go in with
`Object.assign(shader.uniforms, bundle)` — the same objects, so the
environment's writes are read live — and `customProgramCacheKey` must name
everything the source was compiled for, or two materials share one program.
`tests/craft_surface_test.ts` runs the graft over `THREE.ShaderLib.phong` in
plain Node and asserts the hooks landed; a three upgrade that renames a chunk
fails there rather than as a silently matte craft. What no test says is
whether the picture is RIGHT: when a term is washing a surface out, do not
reason about it — build once with `outgoingLight = vec3(F, gloss, sky)`, shoot,
and read the pixels (a PNG decoder is forty lines over `node:zlib`). That
found in one build what three rounds of retuning had not.
