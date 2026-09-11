---
title: A penalty surface with an upward normal is a launcher from every side but the intended one — sweep all 360° of approach, and fix it with a depth threshold AND minimum-translation, never either alone
date: 2026-09-11
scope: engine/game/collision.ts
concepts: [ramp, contact, penalty, repro, sweep]
---

"Riding into X throws me 50 m in the air, spinning" is almost never the
flight model and almost never the solver blowing up: it is a penalty
contact whose normal points UP being applied to a probe that arrived from
a direction where the surface is over its head. The ramp was a one-sided
plane over its WHOLE plan footprint, so a hull meeting it through the end
face under the raised lip got `stiffness × lipHeight` straight upward —
30 m of air on an 8 m ramp, 137 m on a 14 m one, at every speed and on
every craft. Reach for this first whenever a contact surface is authored
as a plane but drawn as a solid.

**Sweep the approach, do not spot-check it.** The repro that is worth
writing is a loop over all 360° of bearing (30° steps) × speed × craft ×
geometry, printing peak `y` and peak |roll|+|pitch| per cell, run once on
`git stash`ed baseline code and once after. That table is the whole
diagnosis AND the whole verification: it names the bad bearing, proves
the other eleven columns did not move, and catches the regression below.
A single staged run cannot do any of that.

**The fix needs both halves.** Minimum-translation alone (push the probe
out through whichever face is the shallowest way back out of the solid)
is the robust part — it holds at any penetration depth, where a fixed
"within 0.6 m of the edge" band silently falls back to the deck normal
once a hull gets deeper than the band. But min-translation ALONE regressed
the ±30°-off-axis graze near the hinge, where the deck stands centimetres
up: a probe 0.2 m under a 0.36 m deck is genuinely nearest the flank, so
it got deflected and capsized where it used to climb aboard. Keeping the
depth threshold (`rampWallBelow`) in front of the min-translation test
restored those columns byte-for-byte. A probe barely under the surface is
riding it; only a DEEP probe needs asking which wall it came through.

**Byte-identical `make sim` is the strongest evidence a contact fix is
surgical.** The bot rides ramps from the correct side, so a fix confined
to the wrong-side path must leave every table and every determinism digest
untouched. If the digests move, the fix reached the normal path and the
sweep did not show you where.
