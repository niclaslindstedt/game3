---
title: Check the drawn deck against a spec sheet's overall height — the bars stood 0.3–0.5 m over a real machine's and only the rider's reach caught it
date: 2026-09-09
scope: pwa/src/game/craft-styles.ts
concepts: [proportions, bars, hood, reach, rider]
---

The sheet's `bars` column plus its `draft` is keel-to-bar-top, the one
number every manufacturer prints (overall height): a Sea-Doo GTI is 1.14 m,
a Yamaha VX 1.15, a Kawasaki Ultra 310 1.15–1.24, a stand-up SX-R 0.84 with
its pole down. With `hood: 0.42` and `column: 0.24` the runabouts stood at
1.42–1.44 and the otter at 1.68, and nothing in the chase view said so —
height reads as contrast there — until the rider's arms had to be at full
stretch on the marlin and could not reach at all on the otter. `hood` and
`column` together are the lever (0.26 / 0.18 for a runabout); the hull's
`height` is the physics' and stays. Before moving the hood, the column, the
pod's station or the saddle's height, read the real number off a spec sheet,
and after moving them run `tests/rider_test.ts`: the reach fails before the
picture shows it.
