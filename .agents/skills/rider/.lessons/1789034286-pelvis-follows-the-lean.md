---
title: The seat mass must be lofted along the TORSO's lean, not the pelvis' vertical, or the small of the back is a hole the chase camera sees through
date: 2026-09-10
scope: pwa/src/game/rider.ts
concepts: [pelvis, torso, lean, holes, chase-view]
---

The pelvis is posed upright (`pelvisUp` rolls but does not pitch) while the
torso leans forward from it, so a seat mass lofted straight up the pelvis'
axis stops in a horizontal disc while the torso's first ring is already
forward of it. Between them, BEHIND the spine, is a wedge of nothing. From
astern and a little above — which is exactly where the chase camera is —
you look down past the lower back and see the saddle through the rider.

It does not read as a hole, either, which is why it survives a review: it
reads as a rider perched oddly high on a seat, or as a saddle drawn too
long. Fix it by lofting ONE mass from under the buttocks to a point up the
torso's own axis (`at(p.pelvis, 0.22, 0, 0)`) and pushing the rings aft
off that leaning line with `Ring.o`, most of it low down; the torso's own
loft then starts inside that mass instead of beside it.

The general rule: any part spanning two frames that pitch differently
(pelvis/torso, torso/head) is lofted along the DOWNSTREAM frame's axis and
offset back, never along the upstream one.
