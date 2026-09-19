---
title: The index prices a tricks run above a race on the same water, so an alternating ladder that CLOSES on a race needs the tricks rung before it to step back
date: 2026-09-19
scope: pwa/src/game/campaign-levels.ts, engine/rating/index.ts
concepts: [campaign, rating, curation, ladder, tricks, day]
---

`RATING.weight.air` is 0.10 and a tricks shore rates 0.6–1.0 on that axis
against a race's 0.2–0.3, so the same coast under the same storm rates about
0.05 higher as a tricks run than as a race. Put a race after a tricks run at
the top of a shore and the ladder steps DOWN, whatever seed is picked: on
three of the four coasts the hardest race in seeds 1..180 (`make rate
--seeds 49,50,…` at the darkest legal hour, squall, wind 14, the top of the
swell dial) came in under the six-minute tricks rung beside it. A lapped
circuit does not rescue it either — the length axis it gains (+0.086) is
roughly the corners axis it loses out at sea.

So the fix is the ORDER's, not the seed's: the tricks rung before a closing
race gives up the worst weather and keeps only the length, and the race
takes the storm. Two of ours dropped a single metre of wind (14 → 13) for
it, which is a day change and costs no digest.

Two things that were worth knowing while hunting for the finale:

- **A coast has an index CEILING, and it is low where the coast has no
  rock.** The mangrove tops out near 0.68 as a race however hard the day is
  blown: its sea axis saturates at Hs 8 m and it has almost nothing to hit.
  Check the ceiling with one wide sweep before promising a rung above it.
- **The darkest legal hour is worth about 0.04.** Going from 18:00 to 18:30
  on the mangrove's spring (the window closes at 18.6) took the dark axis
  from 0.71 to 0.97 and every candidate from ~0.67 to ~0.71, which is what
  made a closing race possible there at all. `daylightWindow(lat, minSun,
  declination)` prints the window; a fractional hour is legal and
  `formatHour` renders 18.5 as 18:30.
