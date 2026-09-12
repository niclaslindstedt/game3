---
title: A static attitude bench that pitches the hull WITHOUT raising it buries the transom — what comes back is a submarine's restoring, not the attitude's
date: 2026-09-12
scope: engine/game/hull.ts, engine/game/craft.ts
concepts: [measurement, bench, hull, buoyancy, attitude]
---

Staging the craft with `placeRun({ pitch })` rotates it about the CoG at a
height chosen for a LEVEL hull. On a 3.1 m hull at 40° that puts the transom
about a metre under, so the buoyancy answering the probe is a hull rammed
into the water, and the bench reports an enormous nose-down moment that grows
with pitch. It reads exactly like a stiff, well-behaved hull and is nothing
of the kind.

An attitude is only meaningful about the point the hull is CARRIED at. Raise
the CoG by `aft·sin θ − cog.y·(1 − cos θ)` (aft = `length/2 + cog.z`) to keep
the transom corner at the waterline, or the raise overshoots and every probe
goes dry instead — the opposite failure, and just as convincing.

Both static forms are easy to get wrong, so prefer the DYNAMIC bench for any
question about an attitude a hull reaches under its own forces: apply the
input and let it find its own trim and its own draft together. The static one
answers "what is the moment at this pose", which is only the question when
the pose is one the hull actually holds.
