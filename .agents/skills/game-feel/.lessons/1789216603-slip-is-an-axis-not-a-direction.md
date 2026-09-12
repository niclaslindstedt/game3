---
title: The chase rigs' slip must be read off the travel's AXIS, not its direction, or a craft going astern saturates the framing and flips it whenever the stern crosses dead astern
date: 2026-09-12
scope: pwa/src/game/camera.ts
concepts: [camera, framing, slip, reverse, discontinuity]
---

`camera.ts` builds the framing's slip from `angleDiff(c.heading, travel)`,
where `travel = atan2(c.vx, c.vz)`. For a hull GOING ASTERN under the brake
that difference is a whisker off ±180°, so two things go wrong at once: it
saturates `soften(..., rig.slipMax)` for the whole reverse — the shot sat
0.21 rad (12°) off the machine — and its SIGN is decided by which side of dead
astern the stern happens to be wandering on this frame, so it swapped ends and
slammed the framing across the shot.

Fold the reading into the hemisphere the nose is in before softening it:

```ts
const off = angleDiff(c.heading, travel);
const axis = Math.abs(off) > Math.PI / 2 ? off - Math.sign(off) * Math.PI : off;
```

A craft backing straight then reads as no slip at all, one backing askew reads
as the few degrees it is askew by, and the reading is continuous through the
stop.

**Test the AIM, not the boom.** The first version of the regression test
measured where the lens was STANDING and passed against the unfixed code: the
boom is placed at the eased `yaw`, and slip only moves `aimYaw`. Measure
`atan2(pose.aimX - pose.x, pose.aimZ - pose.z)` against the nose. Reproducing
the flip also needs a real sea (`sea: { hs: 0.6 }`) — on a mirror the craft
backs dead straight and the difference sits exactly on ±π without crossing.
