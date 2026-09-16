---
title: A QUOTED sea belongs to the coast, not to today's wind — every share and every gate written off `wind` took R36's swell away from a run that asked for it
date: 2026-09-16
scope: engine/game/water.ts, engine/game/fetch.ts
concepts: [swell, shelter, exposure, override, feel]
---

The groundswell is quoted rather than grown, so nothing about it may be read
off the wind. Two places did anyway, and both shipped:

- **Its SHARE was `shelter.exposure`**, the fan measured up the wind. Correct
  for the band the wind grew, wrong for one it did not: a FREE ride with the
  WIND FROM row past the beam took a 20 m swell to 0.4 m at every gate, and at
  180° to nothing. Its share is now `seaExposure(level)` in `fetch.ts` — the
  same fan aimed dead onshore (`level.seaHeading`). It is a function of the
  LEVEL, so it is cached on `level.offshore` (not on the level: `createGame`
  re-wraps a level for an hour or a sky and every copy shares that field).
- **`wind.speed <= 0` zeroed it outright.** That gate is a HARNESS convention —
  zero wind is how every physics test stages still water — not a claim about
  swells, and it silently ate the top of a dial the start card offers. Split
  dealt from asked (`Level.swellAsked`, set where `GenerateOptions.swell` is
  read): an asked height stands in a calm, a dealt one goes with its wind.

The general rule: before writing `wind` into a term, ask whether the thing
being quoted was made by THIS coast's weather. If it was not, the wind may
not appear.

Both moved every sim digest without moving `maxHs` on the corpus (R12's winds
are onshore, so the two fans nearly agree on a dealt level); what moved was
`make surf`'s course line — seed 1 H1/3 4.86 → 6.05 m, crests 97 → 104 m
apart. A quarter sweep (`seaShares` at a mid-course gate, 0° to 180°) is the
cheap regression test and it is now in `waves_test.ts`.
