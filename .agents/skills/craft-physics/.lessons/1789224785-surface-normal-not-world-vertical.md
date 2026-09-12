---
title: Any rate "into the water" must be read against the SURFACE's normal — on a wave face the world vertical says a hull is receding from water it is driving into at five metres a second
date: 2026-09-12
scope: engine/game/hull.ts
concepts: [slam, water, sign-conventions, forces, chop]
---

A probe's immersion rate is not its descent. Differentiate `depth = η(x, z, t)
− y` along the probe's path and substitute the free surface's kinematic
condition (`w = η_t + u·η_x + v·η_z`) and what is left is exactly `−rel·n`
over the unnormalised normal `(−η_x, 1, −η_z)`. The world-vertical reading
`−relY` is that same quantity with `η_x = η_z = 0`, so the two agree on level
water and nowhere else.

This matters because a wave is a FACE and the water on it is moving. Measured
on a hull driving into the back of the wave ahead in a following sea, at the
step the bow went in: `−relY = −1.76`, `−rel·up = −2.08`, `−rel·n = +5.25`.
Both of the first two say the probe is RECEDING — the water under it is
falling away faster than the hull is — while the hull is closing on the
surface at five metres a second. Every force gated on "is this probe entering
the water" is silently off on every wave face in the game.

The generalisation: relative velocity against the water PARTICLE answers "is
this bit of bottom loaded", and it is the right question for a drag or a
planing angle. It is the wrong question for an ENCOUNTER, because a free
surface is a moving boundary and the particle under the probe is not where the
boundary is going. Ask the boundary.

Watch the guard when you fix one of these: `hull.ts`'s slam takes
`min(immersion rate, closing along the hull's up)`, and the second term
inherits the same frame error, so replacing only the first still gets vetoed
in exactly the case you were fixing.
