---
title: An anisotropic drag area applied as |v|·v_i is right at rest and wrong at speed — the extra area goes on by the CROSSFLOW principle
date: 2026-09-14
scope: engine/game/flight.ts
concepts: [aero, drag, crossflow, tuning, sim]
---

Giving the beam its own (much larger) drag area is necessary — a hull abeam is
a slab, not a bow — but applying it the way the isotropic term is applied,
`½ρ·C_dA_side·|v_rel|·v_x`, multiplies it by the whole airspeed. At rest that
is correct (all the airflow IS crossflow); at 90 km/h in a beam wind it is
some 400 N of side force the hull has no business feeling, because the
sideslip is a few degrees.

Measured cost of getting it wrong: `make sim` over four seeds moved the bot's
pace by a fifth in BOTH directions (marlin 44.2 → 36.0 km/h, otter 36.3 →
42.7) while every top speed stayed put. Top speeds not moving is what says the
fault is on the beam and not in the longitudinal term.

The fix is Hoerner's crossflow principle (1965 §3): the force across a slender
body goes with the square of the crossflow alone. Carry the FRONTAL area on
the beam as before and put only the EXTRA (`cdASide − cdA`) on `|v_x|·v_x`.
The two forms then agree exactly at rest, so the leeway bench is untouched,
and collapse to the old behaviour under way. `tests/flight_test.ts` asks
`aeroForces` directly for the slab's own share at 0 and at 28 m/s and holds
them equal — that equality IS the principle's signature and is far cleaner to
assert than any whole-craft run.

General form of the trap: when a change is meant to matter at one end of a
speed range, check the OTHER end explicitly. `make sim` over 4 seeds is too
noisy to tell a real shift from a reshuffle — widen to 16 (`--seeds`) before
concluding either way.
