---
title: Quote a control gain as an ACCELERATION and multiply by the craft's inertia — a torque in N·m catches the dart three times as hard as the otter
date: 2026-09-10
scope: engine/game/flight.ts, engine/game/defs/tuning.ts
concepts: [tuning, inertia, flight, attitude, roster]
---

The roster's pitch inertia runs 165 (dart) to 490 kg·m² (otter) — `inertia(spec)`
in `hull.ts`, worth printing before sizing any torque. A gain stated in N·m
therefore means a completely different correction on each craft, and a value
tuned on the skiff is wrong on both ends of the roster.

State the gain as rad/s² per rad of error instead and let the caller
multiply by that axis's inertia. One dial then means one correction on every
hull, and the number is readable as a spring: `right` = 120 is √120 ≈ 11
rad/s, a quarter-period of about 0.15 s, which is the time it has.

Sizing shortcut: to move θ rad in t seconds needs roughly 2θ/t² of angular
acceleration. Getting `landingAssist` from a 25 that barely moved the bench
to a 120 that worked was one application of that arithmetic, not a search.
