---
title: A rock a hull can ride up on is a SURFACE met by the probes — a flat lid at `top` hands a penalty spring half a metre of penetration in one step and catapults the hull
date: 2026-09-16
scope: engine/game/collision.ts, engine/game/defs/tuning.ts
concepts: [solids, contact, penalty, rocks, probes, ramp]
---

Making `level.solids` climbable means giving them a TOP the hull probes meet,
beside the ground and the ramps. Two shapes were tried and only the second
works.

**A flat lid at `Solid.top`** is the obvious one and it is a catapult. A hull
driving over a rock awash arrives with its keel already 0.3 m below the lid,
so `penalty()` gets that penetration on the first step: `stiffness` × 0.3 is
27 kN a probe, and a dozen probes in the band throw a 330 kg craft metres into
the air. Capping the force only moves the ceiling — the terminal climb rate is
`cap / TUNING.contact.damping`, so 20 kN over 3200 N·s/m is 6 m/s however the
cap is tuned.

**The rock's own rounded surface** fixes it at the source: the stone rises
from 0 at the rim to `top` at the crown, so the penetration starts at zero and
grows as the hull drives in. Fitted to what `pwa/src/game/rock-shapes.ts`
carves — a share of the radius left at the crown, spread over the height on a
power near 1.7 — which also makes the sheer undercut at the waterline fall out
of the geometry rather than needing a special case.

The flank stays a pure radial push (SKILL.md's launcher invariant says why:
peaks were 6.6 m over the sweep with lift in it, under 1 m without). Every
way up a rock is the crown's.
