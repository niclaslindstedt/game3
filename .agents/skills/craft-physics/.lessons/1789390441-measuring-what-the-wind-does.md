---
title: Measure leeway in neutral, beam-on, by differencing positions against the Lagrangian water
date: 2026-09-14
scope: engine/game/flight.ts, engine/game/craft.ts
concepts: [aero, windage, drift, measurement, bench]
---

Three traps silently answer a different question:

- **Use neutral; do not rewrite the craft spec.** Neutral keeps the engine at
  `idleRpm` while producing no net axial propulsion. Patching `idleRpm` to
  zero changes the engine model and hides regressions in the neutral contract.
- **`craft.speed` at an instant contains the wave's orbit**, ±1–2 m/s of it,
  not only drift. Difference POSITION over a minute and subtract the mean of
  `surfaceAt().vx/.vz` sampled along the way, which removes R27's current,
  the phase-resolved orbit and the spectrum's Stokes transport together.
- **Bow-to-wind is the UNSTABLE balance** in this model (the air's centre
  stands forward of the water's), so a craft `placeRun`'d square into the wind
  sits there for a minute doing nothing and reads a quarter of the real
  leeway. Stand it beam-on and let it settle 30 s.

The bench is worth having because it has an EXTERNAL answer. The
search-and-rescue leeway field experiments drift real objects and quote the
share of the 10 m wind each makes: **a watercraft with one person aboard is
4.24 %**, divergence angles out to forty-odd degrees for small craft. That is
what sizes `spec.cdASide`, and `tests/flight_test.ts` holds the whole roster
inside the band.
