---
title: Before trusting a metric a rule was tuned against, ask whether the DEFECT was helping satisfy it
date: 2026-09-16
scope: engine/analysis, engine/mapgen/rules.ts
concepts: [analysis, river, sinuosity, budgets, tests]
---

R26's meander was tuned to a sinuosity band (`river.sinuosity`, 1.12–2.7, the
water's length over the country it crosses) because a river that reads as a
canal is wrong. Stopping the rivers self-crossing dropped the taiga's median
from 1.78 to 1.39 and emptied the mangrove's tail above 2.0 — and the band
itself still held on every seed.

The reason is worth keeping: **a river that ties itself in a knot is longer
without getting anywhere, so it scores HIGH on sinuosity.** Part of the number
the meander had been tuned to was the defect being measured as a virtue. The
same trap applies to any ratio-of-length metric over a line that is allowed to
fold — a course's, a coast's, a lap's.

So when a fix moves a metric a rule was calibrated against, the first question
is not "how do I tune it back" but "was the old value partly the defect". If it
was, retuning to recover it re-introduces what you just removed. Say the shift
out loud in the PR with both distributions instead, and leave the numbers
alone unless a picture says otherwise — `make level` on two seeds per coast is
what settles it.
