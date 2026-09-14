---
title: Measuring what the wind does to a floating craft means killing the idle first, standing it BEAM-on, and differencing positions — not reading `speed`
date: 2026-09-14
scope: engine/game/flight.ts, engine/game/craft.ts
concepts: [aero, windage, drift, measurement, bench]
---

Three traps, each of which silently answers a different question, and all
three bit in one session:

- **The jet idles.** A craft nobody is riding makes **2.16 m/s** of way at
  `spec.idleRpm` — more than any wind will ever blow it (0.1–0.9 m/s). Any
  "adrift" bench with the engine running is benching the pump: the drift came
  out constant at 2.14 m/s from 2 m/s of wind to 16, which is the tell. Patch
  `craft.spec = { ...craft.spec, idleRpm: 0 }` after `createGame`.
- **`craft.speed` at an instant is the wave's orbit**, ±1–2 m/s of it, not the
  drift. Difference the POSITION over a minute and subtract the mean of
  `surfaceAt().vx/.vz` sampled along the way, which takes off R27's current
  and the orbit together.
- **Bow-to-wind is the UNSTABLE balance** in this model (the air's centre
  stands forward of the water's), so a craft `placeRun`'d square into the wind
  sits there for a minute doing nothing and reads a quarter of the real
  leeway. Stand it beam-on and let it settle 30 s.

The bench is worth having because it has an EXTERNAL answer. The
search-and-rescue leeway field experiments drift real objects and quote the
share of the 10 m wind each makes: **a watercraft with one person aboard is
4.24 %**, divergence angles out to forty-odd degrees for small craft. That is
what sizes `spec.cdASide`, and `tests/flight_test.ts` holds the whole roster
inside the band. Before `cdASide` existed the model gave ~1.8 %.
