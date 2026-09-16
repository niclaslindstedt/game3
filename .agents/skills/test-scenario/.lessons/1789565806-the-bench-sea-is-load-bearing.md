---
title: The synthetic bench's SEA is load-bearing — a staged moment quoted in metres of clearance flips when it moves, and the failure names the scenario rather than the sea
date: 2026-09-16
scope: tests/support/synthetic.ts, pwa/src/game/scenarios.ts
concepts: [synthetic, scenarios, sea, bench]
---

`syntheticLevel` is a bench, and its default sea is part of the rig. Raising
its groundswell from ~1 m to ~1.75 m at the hull broke two cases three
directories away: `scenarios_test`'s launch stopped passing through the air
gate, and `tornado_test`'s worst apex went from 30 m to 61 m. Neither failure
mentioned the water.

The reason is that a staged moment is quoted in METRES — `scenarios.ts` stands
the craft a run-up back from a ramp 8 m long and aims at a ring 5 m up — and a
sea that moves the hull a metre either way while it climbs is the bench
measuring the water rather than the hull. Swept it: the launch made the ring at
every swell up to 2 m at the hull and missed at 2.5.

So **keep the bench at the bottom of whatever band the model offers**, and make
any test whose subject IS the water pass its own value rather than leaning on
the default (`syntheticLevel({ windSpeed: 8, swell: 3 })`). A describe about the
swell that reads the bench's default is a describe that re-fails every time the
bench is retuned, and it tells the next session nothing about the swell.
