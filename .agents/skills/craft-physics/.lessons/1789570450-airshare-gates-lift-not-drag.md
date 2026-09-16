---
title: `airShare` gates aeroForces' LIFT and the rider's authority, not its DRAG — a wind pushes a hull that is sitting in the water
date: 2026-09-16
scope: engine/game/flight.ts, engine/game/craft.ts
concepts: [aero, flight, wind, drag]
---

`aeroForces` computes the body-frame drag (`cdA` fore-and-aft and vertical,
`cdASide` on the beam by the crossflow principle) and the windage torques
BEFORE its `if (airShare <= 0) return;`. Only the plate's normal force, the
rider's authority and the rotational damping are behind that gate.

That matters whenever a question is "what does a strong wind do to a hull on
the water": the answer is already "it pushes it", and it is what gives the
leeway the model is calibrated against. Do not add a second horizontal wind
force for a hull at the waterline on the assumption that `airShare` has
gated the first one off — it has not, and the two would double.

The corollary is the real trap: what a hull on the water genuinely does NOT
get is anything worked against `airShare` — which is why the tornado's
column had to grow its own deck floor (`tornado.deckPlate`) before it could
lift a floating hull at all.
