---
title: A glTF parses in plain Node — the asset sheet runs the game's own model code, so it cannot drift from what the game draws
date: 2026-09-28
scope: scripts/craft-preview.mjs, pwa/src/game/craft-models.ts
concepts: [asset-sheet, tooling, gltf, skinning]
---

`GLTFLoader.parse` takes an ArrayBuffer off the disk and needs no DOM for a
file with no textures, and a `SkinnedMesh`'s `getVertexPosition` applies its
bones — so the craft sheet hands the parsed glTF to `adoptModels` and draws
whatever `hangCraft` / `createRider` hang, collapsed code meshes (an empty
draw range) left out. The sheet is the game's merge, dress and rig, not a
lab's second reading of the file. `prepare` must work on a copy of the
loaded scene: merged in place, a second preparation of the same glTF found
one mesh and painted all of it in its first material.
