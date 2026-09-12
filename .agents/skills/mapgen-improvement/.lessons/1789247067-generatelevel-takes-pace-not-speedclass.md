---
title: generateLevel takes `pace`, not `speedClass` — pass the wrong name and a class sweep silently measures class 1 four times
date: 2026-09-12
scope: engine/mapgen/pace.ts, engine/game/step.ts, engine/mapgen/generate.ts
concepts: [measurement, pace, search, rejection, biomes]
---

`createGame` takes `speedClass` and hands it on as `pace`:
`generateLevel(seed, { biome, track, pace: speedClass })`. `GenerateOptions` has no `speedClass`,
and an unknown key is not an error — so a sweep calling
`generateLevel(seed, { biome, speedClass })` builds every level at the DEFAULT pace and comes back
looking flat across the band. Four identical rows in a class sweep is the tell; so is a
`createGame` call failing where `generateLevel` with "the same" options succeeds, which is how this
was caught.

Measured correctly — `generateLevel(seed, { biome, pace })`, seeds 1–60 plus the default shore 38:

| coast | pace | refused /60 | seed 38 |
| taiga | 0.75 / 1 / 1.25 | 0 | ok |
| taiga | 1.5 | 1 (seed 21) | ok |
| mangrove | 0.75 | 1 (seed 9) | ok |
| mangrove | 1 | 1 (seed 42) | ok |
| mangrove | 1.25 | 0 | ok |
| mangrove | 1.5 | 1 (seed 38) | **REFUSED** |

So R32's pace re-rolls the whole search: a seed that builds at one class can be refused at another,
and **the shipped default shore is refused on the mangrove at the top class** — two clicks from the
front door, since the craft card offers `CLASS_BAND` as a radio row. Any claim about how often the
generator refuses a seed has to name the pace it was measured at, and the default shore has to be
checked at every rung of the band rather than at one.
