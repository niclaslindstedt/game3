---
title: A biome's shore.sand multiplier can park the sand threshold exactly on the character field's shelter floor — R21's quilt then rejects a third of all attempts, and 16 seeds cannot see it
date: 2026-09-12
scope: engine/mapgen/biomes.ts, engine/mapgen/geology.ts, engine/mapgen/rules.ts
concepts: [biomes, shore, analysis, measurement, performance, rejection]
---

`materialAt` calls sand at `surface.sand.rugged * biome.shore.sand`, and `ruggedAt` is
`character.bias + grain·noise − character.shelter·inland`. So the character over fully sheltered
water sits at `bias − shelter`, and a coast whose sand threshold lands ON that number has half its
sheltered waterline deciding sand-or-not on noise alone — long marginal runs of one material either
way, which is exactly the fault R21's quilt exists to catch. `geology.ts` warns about it in prose;
the arithmetic is what to check.

The mangrove ships on that number: `0.34 × 1.2 = 0.408` against `0.54 − 0.13 = 0.41`. Measured over
80 mangrove seeds, varying only `shore.sand`:

| shore.sand | built | R21.quilt rejects | all rejects | mean build |
| 1.2 (shipped) | 79/80 | 127 | 442 | 1036 ms |
| 1.1 | 79/80 | 77 | 347 | 850 ms |
| 1.0 | 80/80 | 45 | 268 | 683 ms |
| 0.8 | 80/80 | 34 | 233 | 660 ms |

The cost is not only the refused seeds: it is half a second on the mean build of EVERY mangrove
level, paid on the loading card.

Two procedural points. **Tally rejection reasons across ≥60 seeds per coast and compare the two
coasts' tallies** — the asymmetry is the finding, and a single seed's reasons say nothing. Wire it
by counting `setOutputSink` warn lines matching `rejected — `. And **a biome row measured over 16
seeds is not measured**: 16 seeds all built at 1.2, which is what the row's comment records, while
80 show the real cost.
