---
title: A handful of landmark things a level are carved individually and merged into one mesh — instancing is what makes them all the same rock
date: 2026-09-11
scope: pwa/src/game/rocks.ts, pwa/src/game/rock-shapes.ts
concepts: rocks, rendering, lowpoly, draw-calls, instancing
---

Instancing is the reflex here and it was the wrong reflex for the rocks that
stand out of the water. R17 puts 2.5 stacks and 5 skerries a kilometre and
R25 one mark, so a level carries about ten of them: carving each one for
itself into a shared `lowpoly` Builder and taking ONE `geometry()` a kind
costs 1620–1750 triangles on a 735,000-triangle frame and the SAME SIX draw
calls the instanced version had. Measured on seeds 1, 20 and 38.

What that buys is the whole look, because the transform is baked in and so a
feature can be placed in WORLD space:

- The waterline. A shared geometry cannot carry an undercut at sea level,
  because every rock's root is a different share of its height — a stack
  with a 15 m top over a 23 m bed and one with a 7 m top over a 4 m bed put
  y = 0 at completely different places in the unit box. This is the reason
  to carve, not the variety.
- The foot goes to the actual bed under the rock rather than to a constant
  root. Skerries were the case that killed the proportional root: `top`
  runs 0.4–3 m and the bed under them 5–25 m, a ratio up to 58.

Two traps, both found by looking:

- A ring mutated AFTER the loft does nothing — `Builder.tri` copies the
  numbers it is handed. The crown's broken rim has to be cut before the
  faces are lofted or there is a ring of cracks between face and crown.
- A per-rock seed off `hash2` is a FRACTION, and `hash2` mixes its third
  argument as an integer. Handing 0..1 straight back in gives every rock on
  the coast the same wobble, which looks exactly like the bug being fixed.

The drawn rock must stay inside its collider: `collision.ts` knows a solid
as a cylinder of radius `r`, so let the jag only ever cut IN and apply a
per-rock taper to a ring's DEFICIT rather than to its radius. Both keep the
waterline — where the contact happens — at exactly `r` however hard they
are turned up.
