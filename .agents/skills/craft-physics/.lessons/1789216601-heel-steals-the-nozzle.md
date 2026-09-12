---
title: "\"The steering is inverted\" in reverse was a ROLL bug — a hull heeled 53° has its nozzle's side force tilted out of the horizontal, and the yaw comes out the other way"
date: 2026-09-12
scope: engine/game/craft.ts
concepts: [reverse, steering, roll, rider, nozzle, sign-conventions]
---

A report that reverse steers the wrong way is not necessarily a sign error in
the steering. `rider.leanIn` hangs the rider's mass 0.28 m into the turn off
`input.steer` alone — no speed gate, no direction gate — so a craft held at
lock while going astern kept a full hang-off and settled at **53° of steady
heel** at 12 km/h. At that angle the nozzle's side force, which is stated in
the BODY frame and rotated by `c.q`, is tilted more than halfway out of the
horizontal plane, and the yaw axis is tilted with it. The net yaw came out
REVERSED: `tests/craft_test.ts`'s reverse case measured the bow swinging
−2.13 rad where the model says +0.2.

So the chain was hang-off → heel → lost and inverted nozzle authority, and
every symptom downstream (the wrong-way steering, the camera swinging off the
machine, the rider drawn hunched) had one cause. Fading both weight shifts out
with the way astern (`rider.asternFade`) fixed all of them at once.

Two things to carry:

- **Before believing a steering sign is wrong, print `c.roll`.** A hull lying
  on its ear steers like nothing the model describes, and the roll is the
  cheaper reading to take.
- **Any term driven by `input.*` alone is a term with no idea which way the
  craft is going.** The rider's shifts were the last two; check for others
  before adding one.

`make ride SCENARIO=brake` is the null case that proves the fix is confined:
with `steer: 0` its table is byte-identical before and after, and only
`brake-turn` moves, from row 22 on — exactly where the way crosses zero.
