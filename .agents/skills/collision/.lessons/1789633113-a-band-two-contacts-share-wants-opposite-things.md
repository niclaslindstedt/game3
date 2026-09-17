---
title: A band shared by two contacts is two numbers — narrowing it for one breaks whatever the other was leaning on
date: 2026-09-17
scope: engine/game/collision.ts, engine/game/defs/tuning.ts
concepts: [solids, contact, penalty, rocks, probes, sweep, tuning]
---

`contact.solidRideBelow` was spent in two places that want OPPOSITE things:
the crown's reach in `contactForces` (how deep under the stone a probe may
be and still be carried) and the flank's stand-down in `clipSolids` (how far
below the crown the keel must be before the rock is a wall). The crown's
wants to be deep, so a hull dropping onto a skerry is caught before the
flank squirts it off sideways. The flank's wants to be shallow, because it
is what decides whether a rock the rider can SEE stops them — and at 0.55 m
it was wider than every hull's draft on the plane (0.16–0.25 m), so a rock
up to ~0.37 m proud was exempt from the wall entirely.

Two things to carry forward:

- **Size a stand-down against the HULL, not against the stone.** The band
  that says "this is a step the bow mounts" has to be under the draft, or it
  is describing a wall buried in the bottom of the hull.
- **When you narrow a shared band, find what the other side was leaning
  on.** Splitting it out as `solidWallBelow` = 0.25 immediately cost the
  deep-landing case: the crown's `solidTopCap` = 20 kN let an 8 m drop
  bottom out 0.4 m into the stone, past the new narrower band, and three
  craft of four slid off. The fix belonged at the cause — 40 kN stops all
  four inside the band, and 80 kN lands in the same place, so the cap was
  under-sized rather than the band being wrong.

Judge it on the bearing sweep (12 bearings × speed × craft × `top`, peak y
and peak |roll|+|pitch| per cell). One staged run cannot see this: at
`top` = 0.35 the baseline stopped half the bearings and launched the other
half to 3.9 m, and either half alone reads as correct.
