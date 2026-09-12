---
title: Two relief features closer together than the blur do not merely soften — they CANCEL, and the fix is to stretch the pattern, not to deepen it
date: 2026-09-12
scope: pwa/src/game/wake-profile.ts, pwa/src/game/water-shader.ts
concepts: [wake, relief, blur, stern-wave, mip, grid]
---

The companion to "a mark's relief has to be wider than the relief blur". That
lesson is about ONE feature being too narrow. This is about TWO that are each
wide enough and sit too close: a hollow and a mound of opposite sign inside
one blur kernel average to nothing at all, so the map holds a strong pattern
and the sea is flat.

The transom hollow and the convergence mound are the case. The measurements
put the mound where the two sides close — half a beam over the tangent of
Kelvin's angle, 1.7 m astern on a craft of this beam — and the hollow runs
from the transom to about there. At the true spacing the profile probe showed
the raw map at −0.20 m and +0.28 m and the BLURRED read, which is the only one
the water gets, at −0.04 m and +0.06 m. Both features were correct, both were
big, and the sea did not move.

Deepening them is the wrong reflex: it drives the eight-bit channels toward
saturation and the blurred result barely changes, because what is being lost
is the cancellation and not the amplitude. The fix is to STRETCH the pattern
along the track until the features clear one another — a single stated factor
(`MOUND_STRETCH`, 2.7) with a comment saying it is the renderer's grid showing
through the physics and is the one number here that is not measured. Honest,
one place, and obvious to the next reader.

The diagnostic is the section probe, not the plan view. In plan the crest and
hollow channels were two strong grey washes side by side and looked right; it
took plotting the blurred relief in metres, with the raw map drawn faintly
under it, for the cancellation to be visible at all. If a relief change reads
as "nothing happened", plot the section before touching a number.
