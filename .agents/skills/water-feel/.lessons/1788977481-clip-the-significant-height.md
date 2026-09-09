---
title: Clip the sea at its SIGNIFICANT height, never at the sum of the component amplitudes — the sum is the once-in-forever superposition and it saturates every big sea to the same value
date: 2026-09-09
scope: engine/game/water.ts, engine/game/defs/tuning.ts
concepts: [breaking, depth, spectrum, override]
---

`surfaceAt` capped `Σ(a·Ks)·growth` at McCowan's `0.78·d/2`. But the arithmetic sum of eight amplitudes is where every component crests at once — about 1.8× the significant amplitude, and essentially never — so the clip bound ~1.8× too early and, worse, bound at a value independent of what was asked for: `?hs=8` and `?hs=50` both rendered as 10–11 m of wave. The `hs` parameter was inert above about six metres and a twenty-metre storm photographed as a mirror. The limit belongs on `Hs = 4√m0` over the shoaled, fetch-grown spectrum, against Nelson (1994)'s `Hs/d ≈ 0.55`; individual crests then ride above it as they do in nature. **The tell is a sweep**: print actual crest-to-trough against asked-for `hs` over a range, and if the column stops responding the clip is on the wrong quantity. Depth is the other half — a wave only stands its full height in water it cannot feel the bottom of, so R3's bed had to keep falling past the shelf to 60 m before a 20 m sea could exist at all.
