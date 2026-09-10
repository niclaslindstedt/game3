---
title: Spray reads as water only as MANY SMALL sharp droplets; a few big soft sprites read as smoke
date: 2026-09-09
scope: pwa/src/game/spray.ts, pwa/src/game/fx-textures.ts, pwa/src/game/wake.ts
concepts: [spray, wake, particles, effects]
---

The first pass drew a landing plume as ~300 sprites of 0.4–1.8 m with a disc² falloff at alpha 0.6, and the screenshot showed grey puffs — smoke, not water. What reads as spray: sprites of 0.15–0.6 m, each a CLUSTER of nine small solid drops rather than one disc (a soft disc with grain over it read as soap bubbles at the next zoom), alpha 0.7–0.8, two to three times the count (the pool is 2 400 points in one draw call, so count is cheap), and a fade over the last few metres to the lens — one droplet flying at the camera is otherwise a blob the size of the frame. Judge it ZOOMED: a 3× device-scale capture cropped to the stern shows what a 1280 px frame hides. The wake is the opposite lesson: the WHITE ROAD in the reference photograph is foam ON the water, not particles — the water shader draws it off the wake's map (see the wake-is-a-map lesson) — and the rooster tail is a fine fan over it, not blobs down its middle. Everything the effects read is a `CraftState` field the engine wrote (`planing`, `wetted`, `throttleEff`, `airborne`, `submergedDepth`, `vy`); the one thing observed by difference is the bow plunge (`submergedDepth` rate), because no event fires for it. Observe every STEP (`renderer.observe`), draw every frame: a scene pre-rolled for a screenshot then carries the same spray the player would see.
