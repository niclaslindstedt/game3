---
title: A body torque about axis `a` swings a FIXED WORLD direction the other way round it — an attitude controller written from the cross product is sign-flipped and lands the hull inverted
date: 2026-09-10
scope: engine/game/flight.ts, engine/game/craft.ts
concepts: [quaternion, torque, attitude, flight, sign-conventions]
---

Anything that steers the hull toward an ATTITUDE works on a world direction
seen from the body — `unrotate(q, worldUp)` — and the trap is that the two
rotate opposite ways. Turning the body right-handed by θ about body axis
`a` makes a fixed world direction appear to rotate by −θ about `a`. So the
axis that carries the vector onto its target, `n = upBody × target`, is the
NEGATIVE of the torque axis: apply `+n` and every correction drives the
attitude further from where it should be.

It does not read as a sign bug. `landingAssist` shipped this way for one
round and the flight bench came back WORSE than no assist at all — bad
landings 68% → 79%, with capsizes nearly doubling — because a hand that
rights a hull on its side is, mirrored, a hand that rolls it the rest of the
way over. The tell is a controller whose effect is large, smooth and
consistently wrong rather than noisy: a genuinely mistuned gain overshoots
and oscillates, a sign-flipped one converges confidently on the wrong
attitude.

Check it on the bench before tuning anything: one call with the hull rolled
right and level otherwise should come back with a POSITIVE z torque (a right
roll is −z, so righting it is +z), and nose-down should come back negative x
(nose-up is −x). `tests/assist_test.ts`'s "does fire on one that is not"
case is those two assertions and exists for this.
