---
title: A line DERIVED from Course.path loses the bit-identical laps that keep `distanceAlong` on the right one — bound the search with `before`
date: 2026-09-21
scope: pwa/src/game/guide-plan.ts, engine/mapgen/course.ts
concepts: [guide-line, course, gates, laps, circuit, polyline]
---

R30's lapped course publishes the loop concatenated, so the same water is
passed two or three times and `distanceAlong` has two or three answers for
any point near it. The `after` floor is what picks the right one — but only
because it wins a TIE: on `Course.path` the lap copies are built from the
same numbers, so the distances come out bit-identical and `d < best` keeps
the earliest, which is the lap being asked about.

Derive a new polyline from that path — resample it, bend it, smooth it —
and the tie is gone: the copies now differ in a float's last bits and which
one wins is arbitrary. The symptom does not look like a tie-break: the
guide line vanishes, because the window was measured two kilometres
downstream on the next lap's copy of the same water, and every number in
the plan looks sane on its own.

Two halves to the fix, and both were needed:

- Anything measured ONCE per level (each gate's station) is measured on the
  course's own line and CARRIED THROUGH to the derived one, never looked
  for again on it.
- Anything measured per frame (where the rider stands) passes `before` as
  well as `after` to `distanceAlong` — for the guide that is the checkpoint
  ahead, so the search cannot leave the leg being ridden.

`make level` will not catch it, because it reads one lap. Assert it
directly: every gate's station strictly ascending AND each gate's point
within a few centimetres of `gatePassPoint`, over a multi-lap circuit's
whole gate list.

To PHOTOGRAPH the guide at a rounding, `--scene mark --track circuit` alone
is not enough: it stands the craft on the course's own line, which near a
can is tens of metres off the guide's, so the dashes are abeam and out of
frame whatever camera is asked for. The scene drives straight at the can
for four seconds — `--t 2.5 --camera drone` is the frame where the craft is
at the mark and the bend is around it.
