---
title: Size the open ocean off what the CRAFT can do, not off a number — the jumpable ceiling is a closed form quadratic in the top speed
date: 2026-09-11
scope: engine/game/ocean.ts, engine/game/defs/tuning.ts
concepts: [feel, steepness, tuning, measurement]
---

A sea quoted by its height is a wave of `L₀ = Hs/steepness`, so its
crest-to-trough run grows LINEARLY with its height while a flight's reach
does not. The two cross once, and past the crossing the ocean stops being
something a rider jumps and becomes a hillside he crawls over.

Launching off the wave's own steepest face — `atan(π·s)`, a constant the
steepness dial sets, 15.8° at 0.09 — at `v` and dropping `Hs`:

    Hs = v²·(8s²cos²θ + 4s·sinθ·cosθ)/g = 0.0157·v²   at s = 0.09

so the ceiling is QUADRATIC in the top speed and no ocean height needs to be
authored anywhere. Turn the speed class up and the ocean grows with the
square of it.

Two things the measurement taught. **It is the ceiling of the POSSIBLE, not
of the typical**: staged at every phase of one wavelength at top speed, a
real hull spans only ~0.45 of it (it leaves the water near the crest where
the face has flattened, loses way climbing, and carries aero drag). Keep the
ideal as the definition and the gap as the difficulty. **Stage the launch,
never ride for one**: a 90–120 s ride into a big sea finds a good launch by
luck and reports the luck — its answers scattered by 3× between runs, while
the staged sweep is repeatable.

Vary the dealt storm over the top quarter of the ceiling with a UNIFORM
draw: that is exactly "one seed in ten gets the top tenth", and it needs no
distribution to explain. Measured over 200 seeds: 22 in the top tenth.
