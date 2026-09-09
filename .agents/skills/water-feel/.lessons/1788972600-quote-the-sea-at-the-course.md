---
title: Quote the sea's one period at the COURSE's fetch, never at the level's furthest cell, or every gate gets a swell longer and gentler than its water earns
date: 2026-09-09
scope: engine/game/water.ts, engine/game/defs/tuning.ts
concepts: [fetch, period, spectrum, feel]
---

`createSea` carries ONE peak period for the whole level, and the fetch it is quoted at decides how the sea feels under the gates. Quoting at the furthest offshore cell (the seaward bound, often a kilometre out) gave a period near 7 s — a 68 m roller — on gates standing 40–70 m out whose own fetch earns 4.5 s and 30 m; the hull crossed one crest every two seconds instead of every one. `courseOffshore` (the mean offshore distance of the gates) is the reference now, and `fetchGrowth` runs past 1 to seaward of it, which is fine — it is a ratio. `make waves` prints the reference fetch in its header: if it reads a hundred kilometres on a level whose gates are within a hundred metres of the shore, the quote is wrong. The Hs numbers barely care (∝ √F); the period (∝ F^⅓) and so the wavelength and the encounter rhythm are what move.
