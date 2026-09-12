---
title: Whether there is a WAVE there is a crest length and a face angle, not a height — and a wind sea alone never reads as an ocean at any height
date: 2026-09-12
scope: engine/game/water.ts, engine/game/defs/sea.ts
concepts: [feel, spectrum, steepness, swell, measurement]
---

Hs says how big, the rms slope says how steep, and neither says whether a
rider sees a wave. Two numbers do:

- **CREST LENGTH** — the along-crest correlation length over a patch a few
  hundred metres square, rotated into the wind's frame, at the lag where the
  correlation falls to 0.5. **20 m reads as a sea; 13 m is texture**, and
  comes back as "it's too random, there are no waves".
- **THE FACE ANGLE**, which is Hs/L₀. Three metres over a hundred and
  seventy is two degrees — and from a chase camera a few metres above the
  water that is a plane that slowly tilts, invisible. HEIGHT DOES NOT FIX
  IT: 4 m over 190 photographed the same as 2 m over 170. Length does.

And `TUNING.sea.spread` is a NOMINAL the sea realises about a third of, so
tune the realised one — `acos(|Σ w·d̂| / Σ w)` over the band. A ±34° fan
realised 11° while the cos² was a weight on the energy; drawn THROUGH the
spread the same 34° realised 16°, and the crest length fell by a third.
A frequency-dependent fan must also not open BELOW the peak: the band's
floor is 0.7 f_p, still the peak region, and fanning the longest, most
energetic components is exactly what stops a front forming.

**A locally grown wind sea never reads as an ocean, at any dial setting.**
The fetch law's answer at the bottom of R12's band is 1.2 m at 4.2 s — a
28 m wave — and that is texture however much of it there is. A coast needs
GROUNDSWELL beside it: quoted rather than grown (no fetch here), long,
three components over a tenth of an octave so they beat into SETS, and
quoted at a steepness of the arcade's choosing rather than nature's 0.008.
Gate it on `wind.speed > 0`: zero wind in this engine means the FLAT CALM
every buoyancy case and rest scene is staged on.
