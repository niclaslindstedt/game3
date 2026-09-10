---
title: Course-first killed more of the generator than it added — the rules a shore-first search HUNTED for became properties the corridor is DRAWN with
date: 2026-09-09
scope: engine/mapgen
concepts: [route, basin, course, search, offshore]
---

Inverting the generator (draw the route, then carve the water round it)
deleted `shore.ts` and the station-push loop in `course.ts` outright, and the
reason is worth keeping: R1's offshore band and R5's depth stopped being
things to search for. The corridor's half-width band IS R1 — a channel
2·`offshore.min` wide has its middle inside the band by construction — and
the bed profile under that width IS R5. What was left of `layCourse` was
gates by distance and the air windows.

Three things had to move with the frame, and each is the same lesson:
anything stated as a function of the base line has no meaning in a basin.

- **`offshore` becomes the ONE frame.** Geology takes it as an argument
  instead of deriving it; the rocks and the pods are placed by REJECTION over
  the box against it rather than pushed out from a line.
- **R21's character becomes a field over the plan**, and then R2's "the land
  stops climbing past the reach" has to be read as a mean PROFILE binned by
  inland distance — cell by cell it fails everywhere, because one cell behind
  a taller stretch is climbing without the profile climbing at all.
- **Anything that pushed "seaward" a fixed distance breaks.** A channel has a
  far bank: `scenarios.ts`'s offshore/swell/chop/storm all staged the craft on
  dry land until they walked the gradient and stopped where the water stopped
  deepening.

The bake is a STAMP, not a query: every sample of the route pushes its own
distance into the cells around it. A nearest-segment query per cell is two
hundred segments against three hundred thousand cells and is the whole cost
of building a level.
