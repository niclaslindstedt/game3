---
title: A state-driven effect whose every gate reads TRUE can still draw nothing — probe where its droplets are BORN against `heightAt` before touching a rate, because a hull sitting deep has its keel a quarter of a metre under and nothing born there breaks the surface
date: 2026-09-11
scope: pwa/src/game/spray.ts
concepts: [spray, bucket, brake, height-at, probe, verification]
---

The reverse bucket's boil was gated on `bucket`, `throttleEff`, `wetted` and
`airborne`, all of which read right through the whole brake (a Node probe over
`stageScenario(state, "brake")` printed them every quarter second), and the
still at four seconds showed no boil at all. The droplets were being born at
`keelY` — right for a planing hull, whose keel skims the surface — and a hull
under its bucket at 20 km/h sits its keel 0.2 m under, so a droplet thrown up
at 1.5 m/s rose a tenth of a metre and never came out of the water.

Two things to do before changing a number on any spawn point that reads as
"not there": print the birth `y` against `heightAt(sea, level, x, z, t)` at the
same plan point in Node (`scripts/lib/engine-alias.mjs` makes `scenarios.ts`
importable in seconds), and if it is under, spawn at
`max(hullPoint, heightAt(...)) + lift`. Reading the sea at BIRTH is fine and
cheap — a few calls a step — and does not break the rule that a droplet reads
nothing off the sea after it is born.
