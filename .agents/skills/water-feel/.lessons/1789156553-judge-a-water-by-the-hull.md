---
title: Judge a water by the PITCH RATE it puts in the hull, not by its Hs — a sheltered reach can be a fifth of the open sea's height and shake the craft just as fast
date: 2026-09-11
scope: engine/game/water.ts, engine/game/fetch.ts, engine/game/defs/tuning.ts
concepts: [feel, steepness, fetch, measurement, sim]
---

A player reporting "too many waves in the river, and the ocean is almost
calm" was reporting something the height table flatly denies: the river's
gates ran Hs 0.28 m against the open sea's 1.76 m. Hs is the wrong
instrument. What makes water hard to ride is the wave's scale AGAINST THE
HULL and the rate it arrives at — the river's chop was L0 5.9 m on a 3.1 m
hull (1.9 hull lengths, the pitch-resonant worst case) where the open sea's
swell was 43.6 m (14 hull lengths, which lifts the whole craft).

So measure the HULL, both waters, same level, same pace. Stand the craft
with `placeRun`, hold the bars CENTRED at the quarter of top speed
`scenarios.ts` rides a river at, and read `CraftState.slam` and the pitch
rate. The river came out at 182 N mean wedge impact and 12.9°/s — the same
pitch rate as the open sea on a fifth of its wave height, which is a rumble
strip rather than a sea. At `localFetchScale` 10 it is 76 N and 6.0°/s.

Two traps in that measurement:

- **Ride at the water's own pace.** A first pass at full throttle put the
  craft into the banks and measured bank collisions: the yaw metric swung
  wildly between runs and the slam count would not respond to the sea at
  all. Count `hit`/`ground`/`capsize` runs separately rather than averaging
  them in.
- **`seaSummary`'s Tp is whichever BAND is biggest there.** Shrink the local
  band and the reported river "wavelength" jumps from 5.9 m to 15 m — that
  is the ocean band's period surfacing, not the chop getting longer. Read a
  band's own `tp` off `sea.bands[]` when that is the question.
