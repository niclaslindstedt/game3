---
title: Anything drawn at kilometres needs a distance fade of its own AND a distance-rising brightness — the far plane cuts a hard line, and an additive lattice averages away
date: 2026-09-16
scope: pwa/src/game/edge-net.ts, pwa/src/game/renderer.ts
concepts: [shader, fog, draw-distance, additive]
---

Two failures, both found only by LOOKING, on the edge net standing 4.3 km out:

**The far plane cuts in clear air.** `renderer.ts`'s `FAR` is 4200 m, set by
the sky's outermost shell. A long object seen end-on (a 30 km ring) runs
straight through it and simply STOPS, in a vertical line, with no haze on it
— the scene's fog is the weather's and does not reach that far. Anything
drawn near the far plane needs its own `smoothstep` to zero, comfortably
inside it (2600 → 4050 m here).

**One brightness cannot serve both ranges.** An additive lattice that reads
correctly at arm's length — where it fills the frame — is invisible at two
kilometres, because there the gaps dominate and many strands share a pixel.
Scaling the resting brightness UP with depth (`mix(0.1, 0.62,
smoothstep(200, 1600, vDepth))`) is the fix: what is held constant is how
much of the PICTURE the thing is allowed to be, not how much light it emits.

Also: a weave cut off a distance along a closed ring must divide that ring a
whole number of times, or the pattern meets itself mismatched at one seam.
Round the cell size to `total / round(total / CELL)` rather than shipping
`CELL` as authored.
