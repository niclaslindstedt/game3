---
title: The hump fade is keyed on |speed| through C_v, so any drag term multiplied by `1 − planingShare` silently vanishes on a hull moving BACKWARDS at speed
date: 2026-09-10
scope: engine/game/hull.ts, engine/game/craft.ts
concepts: [drag, planing, reverse, hump]
---

`stepCraft` computes `hump` from `c.speed` (which is `|v|`, direction-free)
and `c.planing`, and hands it to `hullForces` as `planingShare`; the
residuary form drag is scaled by `1 − planingShare`. A craft going ASTERN
under its reverse bucket at 6 m/s has C_v well past `planing.fadeHigh`, so
`planingShare` is 1 and the form drag is multiplied by ZERO — while nothing
is planing at all, because `canPlane` needs `uFwd > 0`.

The symptom was a craft backing up at 27 km/h with an astern drag
coefficient of 1.1 apparently doing nothing. The fix is to branch on the
probe's own `uFwd` sign: astern uses `asternCd` with NO fade, ahead keeps
`formCd` and the fade.

The rule to carry: a fade written against SPEED is a fade that cannot tell
forward from backward. Any term whose justification is "the hull is planing
by now" needs the flow's direction in it, not just its magnitude — and the
comment claiming the fade should say which.
