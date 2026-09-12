---
title: The reverse gate turns the jet's AXIAL sense only — in SIGN and in SIZE — and a braked turn is judged against the THROTTLE in metres, never against a coast in degrees
date: 2026-09-11
scope: engine/game/propulsion.ts, engine/game/craft.ts
concepts: [bucket, reverse, steering, nozzle, brake, measurement, bench]
---

`bucketVector` has been wrong about the same thing twice, once in each half
of a vector. First the SIGN: `craft.ts` resolved the whole thrust off a
share that went negative past the gate's neutral, which reflects the vector,
so full right lock on the brake turned the skiff 20° LEFT. Then the SIZE: the
replacement `lateral = (1 − d) + d·reverse` still scaled the side force down
— to a HALF on the skiff with the gate at the stop — and no gated craft could
be brought through a right angle on the brake at all.

Both come from modelling a deflection as a share of a FORCE instead of a
direction. The gate is a clamshell downstream of the nozzle: it catches a jet
already thrown to one side and sends it forward on that side. Reversing a
vector's axial component touches neither the sign nor the magnitude of its
lateral one, so the correct answer is that `bucketVector` returns NO sideways
share: the side force is the whole jet's, whatever the gate is doing. Ask of
any deflection which COMPONENT the geometry actually turns, and leave the
others alone.

The size half survived a whole pass because the BENCH was wrong twice over.
A brake was compared against a COAST (it beat one 2.7–4.6×, which proved
nothing — a coast barely steers), in DEGREES OF HEADING (which flatters a
hull that is also shedding speed), over a window long enough to end in a
near-standstill (where "radius" reads a pivot). The honest measure is against
FULL THROTTLE from the same entry speed, in metres of path travelled to swing
the bow 90° — the water a rider is actually short of. On that bench the
faults read instantly: `never` against 52.5 m before, 26.4 m after.
