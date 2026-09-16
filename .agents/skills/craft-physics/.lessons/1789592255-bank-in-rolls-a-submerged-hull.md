---
title: A fully submerged hull is stable in pitch and only slowly unstable in roll — what flipped it onto its back in under a second was the SURFACE's bank-in still running under it (the sponsons' lever and the chines' bank), so a planing term must fade with the share under
date: 2026-09-16
scope: engine/game/hull.ts, engine/game/craft.ts, engine/game/submerged.ts
concepts: [submerged, roll, sponsons, chine, planing, bench, capsize]
---

The first reading of a coasting dive was "an inverted pendulum": the deck
floods, the float sits in the bottom below the centre of gravity, and a
hull under water turns itself over. It is the wrong reading, and a bench at
rest six metres down says so (stand the hull with `placeRun`, then set
`craft.y -= 6` by hand — `placeRun`'s `height` will not put a hull under):
level it stays level, nose-down 40° it holds, rolled 30° it drifts at under
half a radian a second. A float below the CoG is RIGHTING in roll, not
capsizing: buoyancy up at a point that has swung to the low side rolls that
side back up.

What rolled a submerged skiff from 30° to inverted in 0.8 s was the two
bank-in terms of the planing surface: `hull.sponsonLever` in `craft.ts`
and the chines' `H.chineBank` in `hull.ts`, both of which roll the hull
INTO the sideways flow over its bottom — which is the carve on the water,
and which a submerged hull RISING while heeled has in full, with no surface
to plane on. Scale both by `(1 − under)` and the roll-over is gone; nothing
about the surface's carve moves, because the share is exactly zero there.

The general form: any term that models a PLANING effect — lift, bank-in,
the sponsons — is a claim about a hull at the interface, and needs a fade
out of the regime where there is no interface, exactly as Savitsky's lift
needs its fade out of the trim band. Read `hull.bottomUnder × deckFill`
(`submergedShare`) for it; a depth cannot tell a buried bow from a hull
under.
