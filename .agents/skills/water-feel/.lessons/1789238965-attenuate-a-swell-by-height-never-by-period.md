---
title: A coast that shelters a groundswell lowers it and never shortens it — scale the dealt height AFTER the period is quoted off it
date: 2026-09-12
scope: engine/game/water.ts, engine/mapgen/biomes.ts, engine/game/defs/sea.ts
concepts: [swell, biome, period, steepness, shelter]
---

The swell is quoted by height and steepness, so its period follows from its
height (`Tp = sqrt(2π·Hs / (g·steepness))`). Applying a coast's
`Biome.sea.swell` share to the height BEFORE that quote shortened the
taiga's swell from 6.6 s to 5.5 s along with lowering it, and
`waves_test`'s "long, ordered" clause caught it — a swell the islands have
broken up arrives lower, not shorter; distance sorted its period a thousand
kilometres ago. Quote the period off the swell as DEALT, then take the
coast's share of the height. The same order holds for the wind bands: the
coast's `sea.wind` scales the height only, and the fetch law's period
stands, which is what makes a sheltered sea gentler rather than choppier.

Reach: every sim digest and `simulation_test` move with any change here,
and `waves_test`'s metre-at-the-shore thresholds read the coast's share
(`biomeOf(level.biome).sea.wind`) rather than a bare number.
