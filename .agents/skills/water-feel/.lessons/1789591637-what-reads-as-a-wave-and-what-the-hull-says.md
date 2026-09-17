---
title: Judge a water by its STEEPNESS, its CREST LENGTH and the PITCH RATE it puts in the hull, never by Hs — and measure with `make sim` before believing a picture
date: 2026-09-09
scope: engine/game/water.ts, engine/game/fetch.ts, engine/game/defs/tuning.ts, engine/game/defs/sea.ts
concepts: [steepness, feel, sim, tuning, spectrum, swell, measurement, fetch]
---

Hs says how big and nothing else. Three readings say whether there is a
WAVE there and what it does to a rider:

- **THE FACE ANGLE, Hs/L₀.** A real twenty-metre sea is a five-hundred-metre
  swell with a ten-degree face — felt at sea, invisible from a boat. The
  quoted sea's `steepness` did more for a monster than any height (8.5 m at
  9.8° → 14.7 m at 32° on that dial alone), and 4 m over 190 photographed
  the same as 2 m over 170: length fixes it, height does not. Steepness
  goes as `heightScale / periodScale²`, so shortening is doubly strong and
  doubly expensive — it raises the encounter rate too. 1.8 / 0.85 looked
  superb and was unridable (76 launches, `make sim` 16/16 → 12/16); prefer
  height over shortness, and keep clear of Michell's 1/7 or the renderer
  foams the whole face into a snowfield.
- **THE CREST LENGTH** — the along-crest correlation length over a patch a
  few hundred metres square, in the wind's frame, at the 0.5 lag. 20 m reads
  as a sea; 13 m is texture ("too random, there are no waves"). Tune the
  REALISED spread, `acos(|Σ w·d̂| / Σ w)` over the band — `TUNING.sea.spread`
  is a nominal the sea realises a third of — and never fan the band below
  0.7 f_p, which is exactly what stops a front forming. A locally grown wind
  sea never reads as an ocean at any dial: a coast needs GROUNDSWELL beside
  it, quoted not grown, three components a tenth of an octave apart so they
  beat into sets, gated on `wind.speed > 0` (zero wind is the flat calm the
  rest scenes are staged on).
- **THE PITCH RATE IN THE HULL.** "Too many waves in the river, the ocean is
  calm" was true at Hs 0.28 m against 1.76 m: the river's L₀ 5.9 m on a
  3.1 m hull is the pitch-resonant 1.9 hull lengths, the swell's 43.6 m lifts
  the whole craft. Stand the craft with `placeRun`, bars centred, at the
  quarter of top speed `scenarios.ts` rides a river at, and read
  `CraftState.slam` and the pitch rate on both waters at the same pace —
  full throttle measures the banks, and `hit`/`ground`/`capsize` runs are
  counted apart. `seaSummary`'s Tp is whichever BAND is biggest there; read a
  band's own `tp` off `sea.bands[]` when that is the question.
