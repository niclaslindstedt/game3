---
title: A hand that must be both QUICK and GENTLE on a hull at the surface is kinematic, like the capsize's righting — a torque cannot be, because the probes' heave drag is quadratic in the rate
date: 2026-09-16
scope: engine/game/submerged.ts, engine/game/craft.ts, engine/game/assist.ts
concepts: [attitude, assist, torque, kinematic, bench, capsize, float-up]
---

The float-up (turn a hull that came out of a dive on its back the right
way up) was written first as `landingAssist`'s shape: a spring on the
attitude error times the inertia, plus a damper. At 9 rad/s² per rad an
inverted hull came round at 0.8 rad/s and took four seconds; at 30 it was
thrown clear of the water by its own rotation, landed, and flopped over
again. There is no gain between, and the reason is the probes: their heave
drag goes as the SQUARE of the vertical speed each probe has from the
rotation, so a spring three times as big turns the hull only half again as
fast, and one big enough to be quick pivots the hull about the water.

The capsize's righting solved this long ago by not being a force: it turns
`craft.q` toward upright over a countdown with the rates zeroed, and eases
the height to the rest draft. The float-up does the same over a lag
(`floatUpPose`), and the linear physics runs on underneath — the drag
scrubs the way, the jet drives it out if the throttle is open. The
landing assist is the one hand that IS a torque, and it can afford to be:
it acts in the air, where there is no water gripping the rotation.

So: an arcade hand acting on a hull IN the water is kinematic; one acting
in the air may be a torque. And a hand that only turns the hull is not
enough under a big sea — left to its buoyancy a hull turned upright five
metres down climbed toward a surface moving away from it; ease the height
too, as the righting does.
