---
title: When a rule number is scaled, every READER of the geometry it drew has to be scaled with it — and the bug only ever appears off the default
date: 2026-09-11
scope: engine/mapgen/pace.ts, engine/mapgen/course.ts, engine/mapgen/route.ts
concepts: [rules, search, rejection, air-gates, measurement, testing]
---

R32 stretches the rule book for a speed class. Both bugs it shipped with had
one shape: a number the stretch MISSED, so the generator drew to one book and
a reader measured against another. Neither is a compile error and neither
makes a wrong-looking level — the search simply refuses every candidate until
it gives up, which reads as "the generator is flaky at that setting".

- **`airCorridor`** is an exported helper that read the module-level
  `LEVEL_RULES`. `layAir` cut its window at the PACED run-up and landing;
  every reader of the corridor — R9's straightness check, the placer's
  keep-out — got the stock one, which on a level below stock reaches out past
  both ends of the straightened window into the bend. 17 seeds in 64 refused
  at class 0.75.
- **`leg.at`** was left unscaled while `route.length` grew. 79 route
  rejections a level at class 1.5 against 2 at stock.

Two habits fall out. **A rule number's own comment names what justifies it**
— `leg.at`'s cited R11's start straight, R4's spacing and R10's shortest
course, all three of which scale, which is the whole argument for scaling it.
Read those comments rather than sorting the table by intuition. And **an
exported geometry helper that reads a rule book needs the pace passed in**,
because it has no level to ask.

The check that catches all of it is one loop: build and `analyzeLevel` a
couple of seeds at EVERY rung the build offers. The shared corpus is drawn at
stock and can never see any of this.
