---
title: Never reason out which SIDE of a rolling hull an effect goes on — measure it with `rotate(fromEuler(...))`, and remember the chase camera mirrors the answer on screen
date: 2026-09-12
scope: pwa/src/game/spray.ts, pwa/src/game/wake.ts, pwa/src/game/rider-pose.ts
concepts: [spray, capsize, roll, sides, verification, screenshots]
---

Placing anything on ONE side of a hull that is rolling — the sheet off the
flank being lifted, the slap of the one coming down, where the rider
surfaces — is a sign question, and both signs are easy to get backwards at
once, which reads as "right".

Two traps, and both bit in one pass:

- **The body→world mapping.** Roll is right-side-down positive, so at
  `roll = +π/2` body **+x points straight DOWN** and body **+y (the deck,
  and the rider on it) points to world +x**. A hull rolled right-side-down
  therefore pivots on its RIGHT chine — that flank is under water the whole
  way round — while the LEFT is carried up over the top, drains, and is the
  one that comes down flat as it levels. Four lines of scratch Node settle
  it for good: `rotate(fromEuler(0, 0, roll), {x:1,y:0,z:0})` from
  `engine/lib/quat.ts`, printed at a few rolls.
- **The screen mirrors it.** The engine's forward is +z and a three.js
  camera looks down its own −z, so a chase camera behind the craft puts
  world **+x on the LEFT of the frame**. A shot that "proves" the splash is
  on the wrong side is proving the opposite.

So: derive the body side from the measurement, then confirm in a
screenshot knowing the flip. The first pass here had the shed born on the
submerged chine and looked plausible — droplets popping out of the water
around the craft — until the flank was checked against the numbers.
