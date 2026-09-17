---
title: The medals are a DOOR set about a fifth of the bot's median, and `simulateStage` cannot ride a pinned day to find it
date: 2026-09-17
scope: pwa/src/game/campaign-levels.ts, engine/sim/simulate.ts, pwa/src/game/campaign.ts
concepts: [campaign, medals, tricks, bot, sim, curation]
---

Two traps in "read the medals off the bot".

First, the harness. `simulateStage` takes a seed, a craft, a level, a track and
a wind — and no hour, no season, no sky, no mode and no clock. A campaign
tricks level is all five of those, so `npm run sim` cannot ride one: it rides
the same shore on the season the seed was dealt, with the course counting and
no buzzer. What measures a rung is a scratch probe over `campaignGame` /
`pinnedGame` (through `aliasEngine`), stepping while `phase !== "finished"` —
the run starts in `countdown`, so a loop on `phase === "running"` returns a
table of zeroes and looks like a bot that will not ride.

Second, the scale. Measured on that harness the bot's medians are 2.1k–3.9k on
the shipped two-minute rungs and 5.7k–10.8k on the four-minute ones, against
committed bronzes of 500–600 and 1000–1500 — about a FIFTH of the median, not
"a little over" it as the file's header claimed. That is the right shape and the
header was the stale half: the medal is the only DOOR to the next rung, while
what the rung PAYS is the podium it is placed on, so a bronze a rider has to
out-ride eleven machines to reach would be the lock charged twice. Pick a new
rung's medals off the neighbouring shores' at the same length and keep the
1 : 3 : 6 step, rather than re-deriving from the bot — the bot's air has grown
since the first twelve were curated and a literally-derived medal would be four
times the rung before it.
