---
title: The rider is one draw call and TWELVE rebuilds — the cost that matters is re-emitting the figure, not drawing it, and the cull for it belongs after the lens
date: 2026-09-20
scope: pwa/src/game/rider-pose.ts, pwa/src/game/rider.ts, pwa/src/game/renderer.ts, pwa/src/game/camera-aim.ts
concepts: [rider, performance, benchmark, culling, frustum, renderer]
---

SKILL.md said the rider is "one draw call and about 1700 triangles — half a
percent of the frame — so roundness is cheap". That is true of DRAWING him
and it was the only number anyone had. `rider.update` is the other one:
`poseRider` solves every joint, `figure` re-emits every facet into the
builder, and `builder.refresh` uploads the buffers — per rider, per frame.
A race has twelve. Measured on a real machine once the benchmark could
attribute it, that stretch (`pose`) was **2.93 ms, 20% of the whole frame**
and half of everything `render` cost — against `water` at 1.61.

**Nothing culled it.** The shore and the cover go through `cullByDistance`;
the field had no frustum test, no distance test, no `visible` check. Every
rival got a full figure lofted at pelvis-16, torso-12 facets whether he was
on screen, behind the camera or a hundred metres astern.

**The cull is two questions and it has to be asked AFTER the lens.** In
view, and near enough to read — `worthPosing` in rider-pose.ts, so the rule
is DOM-free and the suite holds it. The ordering was the whole design
problem: the frustum is cut from the camera, the camera is flown by the rig,
and the posing sat ABOVE all of it, so a cull there would be testing last
frame's frustum and a rival entering view would hold a stale pose for a
frame. The fix is not a fallback — it is to move the camera block above the
posing. Nothing in the posing reads the camera (`rig.update` takes the
engine's `state`, not the meshes; `playerShown` is a module-level flag), so
the two were only in that order by habit.

**Two traps in the cull itself.** The MIRROR counts as the lens: a rider can
be out of the picture and in the water's reflection of it, and testing only
the eye's frustum stands a man in the sea holding a pose from whenever he
was last on screen. And the SPRINGS must go on being stepped for everyone —
`observe` is the engine's cadence and costs a few multiplications, so it is
never what you skip; skip it and a rider coming back into view snaps,
because his body stopped answering the hull while he was away. What he does
while unposed is HOLD the pose he had, which is why the whole thing needs
nothing remembered between frames.

**`renderer.ts` lives at the §20.5 cap, so any of this needs room made
first.** Adding the cull put it at 1015. The exemption marker exists and
taking it for fifteen lines on a file you have just grown is the wrong call:
`aimCamera` came out instead (a rig's pose put on a three camera, the banked
shot's basis included) — it is not drawing, it is self-contained, and it
carried the one piece of algebra in that stretch worth stating on its own.
