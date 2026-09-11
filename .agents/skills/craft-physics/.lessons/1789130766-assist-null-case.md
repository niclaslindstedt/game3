---
title: An arcade assist is judged on its NULL case first — hold "changes nothing when it is not needed" to nine decimals, and the dead band that makes it true falls out
date: 2026-09-11
scope: engine/game/assist.ts
concepts: [assist, tests, arcade, dead-band]
---

Every hand in `assist.ts` has two halves, and the cheap half to get wrong
is the silent one. A help that is merely SMALL still acts on every ride,
and the player feels it as the game steering for him — the ramp's hand
aimed at the centreline from anywhere would be a gutter that rolls the
craft to the middle of every deck, however gentle.

So write the null case as an equality, not an inequality: the same ride,
at dial 0 and dial 1, `toBeCloseTo(..., 9)`. That forces the design to be
a dead band plus a fade rather than a spring — for the ramp, nothing
inside `free` of the half-width, nothing below `pace` up the deck, and
nothing at all while the rider is steering. It is also the assertion that
catches a new hand interfering with an old one: the backflip case in
`assist_test.ts` compares two whole runs at 9 decimals and passed
untouched when `rampAssist` landed, which is the only evidence that the
ramp's hand adds nothing to a jump ridden straight at it.

Two mechanical notes for a test in a ramp's frame: build the world
position and velocity FROM (`along`, `across`) rather than hand-placing
them, or the projection back out is wrong by a sign on some headings; and
a case about the deck's very edge must sit a hair inside it (`half *
(1 - 1e-9)`) or `onRampDeck` rounds it off the deck and the hand
correctly returns zero — which reads as the term being dead.
