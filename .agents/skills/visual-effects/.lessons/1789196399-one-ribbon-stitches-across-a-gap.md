---
title: A trail drawn as ONE ribbon silently bridges every gap in it — a flight comes back as a wedge of wake stretched across the air, and no number fixes it
date: 2026-09-12
scope: pwa/src/game/wake.ts, pwa/src/game/wake-profile.ts
concepts: [wake, trail, ribbon, landing, flight, topology]
---

`wake.ts` lays the trail as one ribbon with a fixed index buffer, so row *n*
is stitched to row *n+1* whatever happened between them. `observe` already
dropped a dead row when the hull left the water — and it still read wrong,
because that dead row was stitched straight to the live row laid at the
TOUCHDOWN: one quad spanning the whole flight, its foam interpolating from
nothing at the take-off to full at the landing. On screen that is a broad
white wedge pointing back at the one stretch of water there is no wake on,
and it grows with the air time.

The cure is topological. A trail that RESUMES opens with a dead row of its
own at the transom, so the void is spanned by TWO dead rows — no width, no
cover, no area, nothing rasterised — instead of by one dead row and one live
one. `trailAction(live, end, moved)` states it three-free (none / close /
open / lay) and `wake_test.ts` holds it. Two cases fall out of the same rule
for free: a hull backing up under its bucket, and the FIRST sample of a run,
whose ribbon neighbour is an unused slot still sitting at the world's origin
— that one paints a wedge from the map's origin on every fresh run.

Whenever a strip, ribbon or trail is drawn from a ring buffer, ask what the
geometry does across a dead entry before reaching for a strength or a life:
a channel that reads 0 at one end of a quad still fills the quad.
