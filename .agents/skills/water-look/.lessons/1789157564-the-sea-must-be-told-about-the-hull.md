---
title: The water grid knows nothing floats on it, and a footwell floor sits at the waterline — the craft's cockpit has to be cut out of the sea in the HULL's frame, under the rail and no higher
date: 2026-09-11
scope: pwa/src/game/water-cut.ts, pwa/src/game/water-shader.ts, pwa/src/game/craft-body.ts
concepts: [water, shader, craft, discard, cockpit, clipping]
---

Every craft's footwell floor stands 3–11 cm over its own rest waterline
(`restY` against `cockpitOf().wells.floorAt` — the dart's is highest, the
otter's lowest), which is where a real one sits, because it drains over the
transom. So a chop of a hand high puts the sea ABOVE that floor, the grid
draws it there like any other water, and it stands INSIDE the hull with the
gunwale dry either side — measured on the `chop` scene, the sea is over the
floor for about a fifth of the seconds it is ridden.

What fixes it is a discard in the water's fragment shader, and three things
about its shape were each load-bearing:

- **In the BODY frame, not the world's.** The test is the craft's own
  opening transformed by the inverse of its quaternion, so a heeled hull
  ships water over its LOW rail for free rather than needing a second rule.
- **Cut to the RAIL, never higher.** Over the rail the sea is coming in over
  the side, which is a real thing a wave does to an open boat and the one
  case a player will not read as a bug. Stopping at the rail is also what
  keeps the awash frames untouched — check one (`--scene chop --t 1.69`
  against `--t 1.91`) and confirm the diff is empty.
- **The wall is the hull's own SKIN, read at both ends of the opening.**
  Anything wider notches the sea beside the topside; anything narrower
  leaves a bright line of water along the well's outer edge. The hull tapers
  by about a fifteenth over the cockpit, so ONE width for the whole of it
  misses by a centimetre in the middle — rule it between the two ends.

Two traps in the verification, both of which cost a round:

- **Almost every frame is not the bug.** At rest the sea is BELOW the floor
  and nothing is drawn in the well, so a screenshot proves nothing and an
  inflated debug box changes nothing either. Find the moment first, in pure
  Node: step a staged scene and print the sea's height at the well's plan
  points in the body frame (`unrotate`), then shoot that `--t`.
- **A before/after diff is the only honest read.** The wells are dark and the
  water over them is dark; the two crops read as identical to the eye and the
  diff shows two clean footwell-shaped patches and nothing else.

`water-shader.ts` was at 990 lines when this landed, so the cut went to its
own module and is interpolated into the fragment source the way the wake's
chunk is.
