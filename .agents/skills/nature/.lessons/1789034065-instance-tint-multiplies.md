---
title: Vary a per-instance colour by MULTIPLYING it, never by offsetting HSL lightness — a dark swatch is far darker in linear space and an offset clamps it to black
date: 2026-09-10
scope: pwa/src/game/rocks.ts, pwa/src/game/flora.ts
concepts: [rocks, rendering, colour, transparency]
---

`THREE.Color` converts a hex swatch from sRGB to linear on construction (colour management
is on), so a colour picked as a plausible-looking dark olive — `0x2c3d32` for the reefs —
lands at a linear lightness of 0.036, roughly a quarter of what the eye expected. An
`offsetHSL(0, 0, v)` of ±0.12 is an ABSOLUTE step in that space: on a colour that dark it
clamps straight to zero, and the reefs rendered as pure black holes in the sea.

Use `color.copy(tint).multiplyScalar(1 + v)` instead. It is proportional, so it can never
bottom out whatever the base tone is, and it is what `flora.ts` does for its instance
tint. When a swatch is meant to read dark on screen, pick it a step or two lighter than
looks right on paper — three will take it the rest of the way down.
