---
title: A hand-built `CraftInput` missing a field NaNs the craft on step one — and the brake lever is called `reverse`, so `{ brake: 0 }` typechecks in a `.mjs` lab and silently poisons three of the four craft
date: 2026-09-16
scope: tests, scripts
concepts: [scenario, staging, input, repro, tooling]
---

`CraftInput` is `{ steer, throttle, reverse, lean, crouch, reset }`. The
brake-and-reverse lever is **`reverse`**, not `brake`. Hand-write
`{ steer: 0, throttle: 0.7, brake: 0, lean: 0, crouch: 0, reset: false }` in a
`scripts/` lab and `input.reverse` is `undefined`, which multiplies through the
bucket and turns `q`, `wy`, `heading`, `rpm` and `throttleEff` to NaN on the
FIRST `stepCraft`.

What makes it expensive is how it presents: the DART has no bucket
(`spec.bucket.reverse` 0) so it rides perfectly, while the skiff, marlin and
otter all NaN. Three craft broken and one fine reads as a per-craft physics
bug, not as a typo in the harness — and a `.mjs` lab gets no typecheck to say
otherwise.

Spread `NEUTRAL_INPUT` instead of writing the literal
(`{ ...NEUTRAL_INPUT, throttle: 0.7 }`), in a `.ts` test and a `.mjs` lab
alike. When a staged craft does go NaN, the fast bisect is to walk
`Object.entries(craft)` after one step and print every non-finite field: the
SET of fields that went bad names the term, and a NaN that reaches `q` and
`rpm` but not `x`/`y` on step one is an input, never the water.
