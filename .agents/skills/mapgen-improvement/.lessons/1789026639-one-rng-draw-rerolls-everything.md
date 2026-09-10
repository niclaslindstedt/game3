---
title: One new draw off the generator's rng re-rolls every level from that point on — the population tests and every sim digest move, and a before/after sim is no longer like for like
date: 2026-09-10
scope: engine/mapgen, engine/sim
concepts: [determinism, rng, sim, testing]
---

Adding `inBand(rng, R.river.discharge)` inside `drawRiver` — one number, for
a feature nothing else reads — shifted the seeded stream for the wind, the
hour, the course, the rocks and the fauna that are drawn after it. Every level
came out different: seed 38 went from 16 gates to 12, and two statistical suites
(`mapgen_population_test`'s "air gates are two or three, and both counts
occur", `fauna_test`'s rarity ladder) failed on the new corpus and passed again
once an unrelated rule change was reverted.

Two consequences worth budgeting for before you add the draw:

- **The population tests are a corpus check, not a rule check.** When they fail
  after a stream shift, re-run them before assuming the change broke something —
  and do not "fix" them by widening the assertion.
- **`make sim` before and after is NOT a like-for-like ride comparison.** The
  levels are different, so pace, gates and misses all move for reasons that have
  nothing to do with the change. To isolate the change's own effect, neutralise
  it in place instead (set its tuning constant to 0 and re-run on the SAME
  branch) — that is what showed the river's current was not costing the bot
  gates, where the before/after table suggested it might be.
