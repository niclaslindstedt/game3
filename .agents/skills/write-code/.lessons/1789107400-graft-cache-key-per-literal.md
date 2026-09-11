---
title: A graft that bakes a per-species LITERAL into one of three's materials needs its own `customProgramCacheKey`, or every species compiles to the first one's shader
date: 2026-09-11
scope: pwa/src/game/fauna.ts, pwa/src/game/bird-shapes.ts, pwa/src/game/craft-surface.ts
concepts: [three, shader, grafts, materials, instancing]
---

Three keys a compiled program by the material's parameters plus
`material.customProgramCacheKey()`, and the DEFAULT of that is
`onBeforeCompile.toString()` — the SOURCE TEXT of the graft function. A
closure built once per species with different numbers baked in as literals
(`${num(style.bend)}`, the bird's wrist) has the same source text for every
species, so the second species asks the cache for "the same program" and is
handed the first one's: every fish beats with the herring's tail, every bird
folds at the gull's wrist. Nothing warns; the lab shows one species at a
time and looks fine.

Set the key to say what was baked: `material.customProgramCacheKey = () =>
\`bird:${spec.id}\``. `craft-surface.ts` does this for its sky/no-sky and
sheet-count variants and is the pattern; `fauna.ts` had the bug from its
first commit and `bird-shapes.ts` was written with the key from the start.
