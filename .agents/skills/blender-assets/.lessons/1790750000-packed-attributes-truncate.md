---
title: Never clone-and-transform a packed glTF's geometry — its positions are 16-bit ints and the metres truncate to nothing
date: 2026-09-29
scope: pwa/src/game/mark-models.ts, pwa/src/game/tree-models.ts, scripts/lib/glb-pack.mjs
concepts: [gltf, meshopt, quantization, loader]
---

A model packed by `glb-pack.mjs` carries its positions as `SHORT` steps
with the step on the node's scale. three's loader keeps the `Int16Array`,
so `geometry.clone().applyMatrix4(mesh.matrixWorld)` writes the metres
BACK into the integer array and every vertex becomes 0 or 1 — a gate mark
that decoded to a point at y = 1 and a can with its foot at 0. Read every
attribute out through a `Vector3` into a `Float32Array` (`partsOf` in
`tree-models.ts` and `unpacked` in `mark-models.ts` both do), and hold the
decoded bounds in the set's suite: `mark_models_test.ts` is what caught it.
