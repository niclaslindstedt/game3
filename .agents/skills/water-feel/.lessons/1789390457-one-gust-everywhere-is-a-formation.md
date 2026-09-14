---
title: A gust that is one scalar for the whole level makes every craft on the water move in step — and a point-wise wind assertion cannot survive giving it a size
date: 2026-09-14
scope: engine/game/wind.ts, tests/wind_test.ts
concepts: [wind, gusts, turbulence, tests, rivals]
---

`stepWind`'s Ornstein–Uhlenbeck gust was one number everywhere at once. That
is honest for the energy-containing eddies (hundreds of metres) and wrong for
everything under them, and what it looks like on screen is a race grid of
twelve hulls leaning on the bars together. Turbulence has a SIZE: split
`intensity` between the level-wide process and an advected field, variances
adding (`squallShare`), and weight the field's octaves by Kolmogorov —
amplitude as the cube root of the scale.

Two things worth knowing before doing it:

- **Check the field against Davenport, not against itself.** The exponential
  coherence model (decay 12, IEC 61400-1) integrated over a Kaimal spectrum
  gives the along-wind correlation at a separation. A seven-octave fBm lands
  within a few tenths of it (0.89 vs 0.76 at 4 m, 0.49 vs 0.43 at 30 m). It is
  the only way to tell "decorrelated enough" from "noise I liked the look of".
- **Normalise by MEASUREMENT.** One octave of `valueNoise` centred on zero has
  σ ≈ 0.209, not the 0.176 arithmetic suggests. Export the field and have the
  test measure what it delivers.

The test fallout is the part that surprises. Four cases in `wind_test.ts`
asserted `windSpeedAt(...)` ≈ the level's mean at a POINT, to three decimals.
With a field there is no such point — the mean is what a patch averages to.
Rewrite them as a patch average or a line average along the shore (the storm
ramp and the shelter vary only with distance offshore, so an x-average is the
mean wind there with the turbulence taken off), and hold them to a few percent
rather than to `toBeCloseTo`. Expect the same in any suite that reads a single
wind sample.
