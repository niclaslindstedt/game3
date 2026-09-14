---
title: The reach to the grips must be bounded BOTH ways — a lean forward walks the shoulders onto the bars, and a fold under a fifth of the arm is an arm that disappears
date: 2026-09-14
scope: pwa/src/game/rider-pose.ts
concepts: [pose, reach, arms, lean, ik, stance]
---

`poseRider`'s relaxation loop originally only handled the shoulders being
too FAR from the grips. The near end was the bug: leaning forward pitches
the torso about the pelvis AND slides the pelvis forward under it, and
hanging off into a turn rolls and slides it sideways as well, so the three
together put the inside shoulder within a HUNDREDTH of the arm's length of
its own grip on every seated craft. `solveLimb` then has nowhere to put the
elbow but back along the arm's own line — the `cosA` clamp at −1 — and the
arm folds inside the vest. From the chase camera that is a one-armed rider,
and it reads as a missing limb rather than as a bad pose.

Two things fix it and both are needed. `STANCE.reachMin` (0.28 of the arm,
an elbow at ~32°, a human's limit of flexion) is the near bound, eased by
standing the torso back UP; and the elbow's IK pole swings from "down and a
little out" to OUT AND UP as the arm folds past a right angle, which is
where a rider crouched over his bars actually puts it.

**Do not make `reachMin` comfortable.** The lean, the throttle's crouch and
the tuck all buy their whole read by folding the arm — at 0.42 of the arm
the tuck moved the torso by literally nothing and `rider_test.ts`'s two
lean assertions failed. What keeps a deep fold legible is the winged elbow,
not a shallower fold.
