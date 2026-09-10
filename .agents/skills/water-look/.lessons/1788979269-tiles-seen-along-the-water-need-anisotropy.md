---
title: A tile sampled on the water (ripples, foam) needs anisotropic filtering, or at a grazing angle it smears into streaks radiating from the lens and the sea reads as brushed metal
date: 2026-09-09
scope: pwa/src/game/water-shader.ts, pwa/src/game/fx-textures.ts
concepts: [water, shader, textures, ripples, foam]
---

The chase camera sits two metres over the water and looks along it, so every
texel of a tile on the sea is minified far harder across the view than along
it. Isotropic mipmapping picks the level for the worse axis and blurs BOTH,
which wipes out the variation across the screen and leaves only the variation
along it: the first build of the ripple tile came out as corduroy streaks
fanning from the camera, and the same happens to the foam tile under the
wake. `texture.anisotropy = TEXTURE_ANISOTROPY` (`fx-textures.ts`, 8; three
clamps to the hardware) is the whole fix. Two things that help but are not
the fix: slewing the tile's sine crests well off square and adding noise on
top so no two crests run parallel, and turning the coarse layer off the wind
so the two layers do not tile together. Judge it in the SwiftShader
screenshot — it honours the extension, and the streaks show there as well as
on a GPU.
