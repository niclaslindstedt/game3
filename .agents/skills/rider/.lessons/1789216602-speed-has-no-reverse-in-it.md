---
title: A surge differenced off |v| has no reverse in it — it throws the torso BACK when the craft gathers way astern and snaps it through the vertical at the stop
date: 2026-09-12
scope: pwa/src/game/rider-pose.ts
concepts: [dynamics, springs, surge, reverse, lean, sign-conventions]
---

`createRiderDynamics` drove the torso's bob from `(c.speed - pSpeed) / dt`.
`c.speed` is a MAGNITUDE, so a craft gathering way backwards reads as one
accelerating and the body was thrown back against a jet pushing it at the
bars. Worse, the magnitude turns round at the stop: the measured lean fell
smoothly to 26.8° then **snapped to 17.6° in a quarter second**. That step is
most of what reads as the rider lurching about while backing off a mark.

Read the way made good instead and differentiate that: it passes through zero
without a sign change, and accelerating astern throws the body forward, which
is where it actually goes.

**Read it off the NOSE, not off `c.heading`, and gate it to AFLOAT** — this
session shipped `c.heading` first and the flight suite caught it within the
hour. `heading` comes through `toEuler`, which swings it a clean 180° as the
pitch folds at ±90°, so a hull half way round a backflip reads as one going
backwards; and even read honestly off `rotate(c.q, {0,0,1})` flattened, an
inverted hull at the top of a flip IS travelling backwards along its own nose.
Either miss strips the rider mid-flip (`craft_test`'s speed-class flight case
failed at 1.2555 against a 1.25 bar — marginal enough to look like noise, and
it was not). In the air, hold the surge at zero: nothing pushes a rider along
a hull there, gravity taking him and the machine equally.

`RiderRead.pace` and `.throttle` carry the same trap: `c.speed / top` buys a
lean into a wind a craft going backwards has not got, and the brake lever opens
the throttle itself for the bucket (`pump.bucketThrottle` = 0.65), so a rider
hard on the brake read as one hard on the gas and sat in a racing tuck at
walking pace. Discount that by `c.bucket`. **The forward-braking lean survives**
— it is the deceleration and arrives through `bob`.

The rule: every reading the pose is built from must be something the rider can
FEEL. A pump's revolutions and a speed's magnitude are neither.
