---
title: Every hard edge in the night sky came from a coordinate that stops being continuous — a branch cut, a threshold, or a hash that is not injective
date: 2026-09-11
scope: pwa/src/game/starfield.ts
concepts: [sky, night, stars, shader, noise]
---

The sky is a SPHERE, and three separate things in `starfield.ts` quietly
assumed it was a plane. All three read to the player as the sky repeating
itself.

**A branch cut.** The Milky Way's mottle was sampled at
`atan(across, along)`, which jumps by a full turn across one meridian. Value
noise on an open lattice does not come back round with it, so the two ends of
the turn landed in unrelated noise and ruled a hard line down the sky —
straight through the brightest part of the band. The fix is a lattice that
FOLDS: a whole number of cells to the turn and `mod` on the cell index, with
octaves that DOUBLE rather than rotate the domain (a rotation mixes y into x
and there is no period left to fold at). The cloud chart's field must stay
un-periodic — a sheet is a plane and has no turn to close — so the band needs
its own.

**A threshold.** `if (band <= 0.004) return 0` drew a hard circle round each
galactic pole, eight levels of a black sky. Subtracting the floor instead of
testing against it reaches the same place at nothing, and costs the rest of
the band a fraction of a per cent.

**A flattened hash.** One star to a cell of a 3D grid, hashed through a vec2
hash as `(x + 57z, y + 13z)`, is not injective — and the cells that collide
satisfy one linear equation, so they lie along a CIRCLE on the sphere. Four
per cent of the sky was an exact copy of another band, same stars, same
brightnesses. A real 3D hash fixed it and moved the star census by under five
per cent, so the thresholds did not need retuning.
