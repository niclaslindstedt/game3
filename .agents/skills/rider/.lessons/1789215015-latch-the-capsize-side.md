---
title: Latch which way the hull went over on the FIRST step past its beam — `Math.sign(roll)` is meaningless once the roll wraps past ±π and will flip the pose across the craft mid-capsize
date: 2026-09-12
scope: pwa/src/game/rider-pose.ts, pwa/src/game/spray.ts
concepts: [capsize, roll, sides, rider, pose]
---

Anything that answers "which way did it go over" — the side the rider
throws his weight toward (`HAUL`, `createRiderDynamics`), the flank a
splash is born on — must LATCH the side once, on the first step the hull
is past its beam, and hold it until the hull is level again.

Read per step instead and it flips under you twice: `toEuler` wraps, so an
inverted hull rocking about ±π returns +3.07 on one step and −3.10 on the
next (`tests/buoyancy_test.ts`'s own capsize does exactly this), and the
righting then runs the roll back down through zero with whatever sign it
happened to land on. The rider swaps sides of the saddle halfway through
the haul, and nothing in the numbers looks wrong.

Latch at the same threshold the effect starts at (`HAUL.fromRoll`, 1.2 rad
— well past any carve), clear it when the excursion ends, and reset it in
`reset()`. If two modules need the same answer, check they latch on the
same step rather than trusting that they will agree: a scratch probe that
steps the `capsize` scenario and prints both is thirty seconds and is how
this one was confirmed.
