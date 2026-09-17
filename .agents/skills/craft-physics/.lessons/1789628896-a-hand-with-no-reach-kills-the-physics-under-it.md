---
title: An arcade hand with no REACH does not soften the physics under it — it deletes it, and the tell is an outcome that does not vary across the whole input range
date: 2026-09-17
scope: engine/game/assist.ts, engine/game/defs/assist.ts
concepts: [assist, attitude, capsize, stability, game-feel, measurement]
---

`landingAssist` took the SHORTEST turn from the predicted attitude to level
with no bound on how far that turn was, so it hauled a hull round from 150°
of roll and put it down flat. The consequence was not "landings are a bit
soft": the capsize became unreachable at every dial, and everything built to
show one — the rider swimming the hull round (`rider-pose.ts`), the boil
under it (`wake.ts`), the pulse in the hands (`rumble.ts`) — was dead code
that nothing failed over. The hull's own hydrostatics were correct the whole
time (its righting arm goes through zero near 90°); they were simply never
consulted.

**The tell is an outcome that does not vary across the whole input range.**
Staged drops at 40°, 60°, 90°, 120° and 150° of roll came back with the hull
never once heeling past 58° after touchdown — five wildly different inputs,
one answer. A mistuned gain oscillates and a flipped sign converges on the
wrong attitude (both already in SKILL.md); a hand with no reach gives a
CONSTANT, and a sweep whose output is flat is the cheapest way to find one.
Sweep any controller across its input to the far edge of what is physically
reachable, not just across the band it was tuned on.

The fix is the dead band's mirror: a controller needs a REACH as well as a
tolerance. Full strength below `rollHold`, fading to nothing by `rollReach`,
and `rollReach` chosen off the GEOMETRY it must not overrule — 1.05 rad,
a clear 30° short of the righting arm's crossing — rather than off the
bad-landing column, which was flat across the whole ladder anyway. Fade the
RATE DAMPING on the same schedule or the hand keeps the rotation it has
stopped steering: damping a rate whose attitude you have let go of is the
same save by another route.
