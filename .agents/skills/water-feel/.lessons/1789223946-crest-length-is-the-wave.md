---
title: "\"No waves are forming\" is a CREST LENGTH, and a nominal spread realises a third of itself — measure the along-crest correlation and the energy-weighted spread, never the dial"
date: 2026-09-12
scope: engine/game/water.ts, engine/game/defs/sea.ts
concepts: [feel, spectrum, steepness, measurement]
---

Hs says how big, the rms slope says how steep, and neither says whether
there is a WAVE there. What a rider reads as a wave is a crest with length
to it, and the number for that is the along-crest correlation length: sample
the surface over a patch a few hundred metres square, rotate into the wind's
frame, and take the lag at which the correlation falls to 0.5 along the
crests and across them. **20 m along is a sea with waves in it; 13 m is
texture, and it comes back as "it's too random now, no waves are forming".**
The ratio along/across (4–5) is the short-crestedness.

`TUNING.sea.spread` is a NOMINAL half-width and the sea realises about a
third of it, so it is not the number to tune against. Measure the realised
one — the energy-weighted circular spread of the band,
`acos(|Σ w·d̂| / Σ w)`. A ±34° nominal fan realised 11° while the heading was
drawn flat and the cos² weighted the energy (the weighting threw the fan
away); drawing THROUGH the spread made the nominal nearly honest, so the
same 34° then realised 16° — and the crest length fell by a third. 26°
nominal realises the 11° the game was tuned at.

The other half of the same trap: a frequency-dependent fan must not open
BELOW the peak. Mitsuyasu's law does, but a band's floor at 0.7 f_p is
still the peak region, and fanning the longest, most energetic components
is precisely what stops a front forming.
