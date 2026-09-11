---
title: A boom that turns without its aim point points OVER the rider — measure a framing complaint as the craft's place in the FRAME, never as the lens's height or standoff
date: 2026-09-11
scope: pwa/src/game/camera.ts, pwa/src/game/camera-rigs.ts
concepts: [camera, framing, flight, landing, measurement]
---

Reported as "the rider disappears downward when he jumps a wave". Every
reading the rig already had said it was fine: the rod held its length, the
lens followed the craft down, `flyAndLand`'s `lens` and `behind` series were
smooth and the jolt test was green. **They cannot see this class of fault at
all** — a lens can hold its standoff and its height and still be pointed over
the rider's head.

The reading that sees it is the craft's own place in the PICTURE: the angle
off the view axis over the half field, +1 the top edge, -1 the bottom
(`framedY` in `tests/camera_test.ts`). Measured on a ramp drop it marched from
its resting -0.32 to **-1.02 — out the bottom — on `chase`, and -1.30 on
`close`**: every rung of the ladder lost him. Compute the half field from
`pose.fov`, not from the rig row: the fov widens with pace, so the same
geometry frames differently at 60 km/h.

The cause was the rod turning the LENS onto the flight path while
`pose.aim*` stayed out on the water ahead at `sprungY + aimHeight`. The fix
is to rotate the aim offset through the same angle, which makes a flight a
rigid rotation of the whole shot about the craft: the rider's place in the
frame is then invariant under the rod by construction, and what the flight
moves is the HORIZON. The landing bounce comes along free and reads far
better — the view pitch sweeps -43° → -2° → -6°, so the horizon nods.

Two things this bought that a bigger follow rate would not: the framing holds
at any fall speed rather than at the one that was tuned, and the shot still
*looks* like a fall, because the picture tilts.

Beside it, `Math.max(0, ...)` on the air excursion was a second half of the
same fault — a reading gated to one sign catches a climb and lets go of a
drop. Look for that shape wherever a flight is read.
