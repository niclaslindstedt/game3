---
title: A rung needs a WINDOW before it needs a seed — two steps of `LADDER.step` between its neighbours, opened with a day rather than a seed
date: 2026-09-19
scope: pwa/src/game/campaign-levels.ts, engine/rating/index.ts
concepts: [campaign, rating, curation, ladder, day]
---

Inserting a rung between two that already stand means landing the index inside
a window `2 × LADDER.step` (0.04) wide at minimum — `rateLadder` notes a step
under 0.02 on EITHER side. So read the gap off `make rate CAMPAIGN=1` FIRST
and only then go looking for a seed: shortlisting on character and discovering
afterwards that the target window is 0.029 wide is the whole sweep spent twice.
On the arctic it was exactly that — FLOE LAPS 0.465 and NARROW LEAD 0.494 left
no room at all — and the fix was a metre more wind on NARROW LEAD (13 → 14),
which moved it to 0.510 and opened a 0.045 window. Moving a neighbour's DAY is
always the first move, never a neighbour's seed.

The reason it is free: `buildCampaignLevel` reads `seed`, `biome`, `track`,
`tricks`, `swell` and `version`. The hour, the season, the sky and the wind are
the RUN's (`campaignGame`), so changing any of them re-rates a rung without
touching its digest, its layout or its name. **`swell` is the exception** — it
is a build parameter (R36), so a rung re-swelled owes a new digest and a
`make routes`.

Candidates must be rated under the day you intend to pin, not the day the sweep
dealt them: `make rate --seeds a,b,c --tricks --hour H --season S --weather W
--wind M --swell N` prints the index AND the digest to write down, so one call
both shortlists and produces the table's numbers.
