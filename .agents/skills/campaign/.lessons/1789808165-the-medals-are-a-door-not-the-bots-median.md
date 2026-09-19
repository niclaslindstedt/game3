---
title: The medals are a DOOR set well under the bot's median, and the probe that finds it rides the pinned day ALONE
date: 2026-09-17
scope: pwa/src/game/campaign-levels.ts, engine/sim/simulate.ts, pwa/src/game/campaign.ts
concepts: [campaign, medals, tricks, bot, sim, curation]
---

`simulateStage` takes a seed, a craft, a level, a track and a wind — and no
hour, no season, no sky, no mode and no clock. A campaign tricks rung is all
five, so `npm run sim` cannot ride one. What measures a rung is a scratch probe
over `pinnedGame` (through `aliasEngine`), stepping while `phase !== "finished"`
— the run starts in `countdown`, so a loop on `phase === "running"` returns
zeroes and looks like a bot that will not ride.

Ride it ALONE (`pinnedGame(level, "tricks", craft, { limit })`), not through
`campaignGame`. The campaign's grid is eleven more `GameState`s stepped per
step: 8½ minutes of wall clock for one two-minute rung on four hulls, against
40 seconds without it. The field cannot touch a tricks score (`contact` is
off) but its WASH is on the shared sea and the bot jumps off it, so the same
rung reads about twice as high with the grid on (mangrove-2: 2404 alone,
5970 with it). Read the probe as a SHARE of its own median, never as an
absolute against another run's numbers.

Then set the medal off the NEIGHBOURING shores' at the same length on the
1 : 3 : 6 step, not off the bot — the bot's air grows between passes and a
literally-derived door would be four times the rung before it. The probe is
the sanity check: the shipped rungs sit at 13–26% of the alone-median, and
anything near half is wrong. That is also how a bad rung shows up — `taiga-4`
was curated on seed 16 until the probe scored two hulls at 489 and 533 in
three minutes (a 49% door); seed 36 under the same day scored 1844–8352 and
took its place.
