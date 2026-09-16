---
title: A quoted sea's size dial is an INVISIBILITY dial at the top of its band unless the wavelength is capped — a fixed steepness makes 20 m a 570 m wave
date: 2026-09-16
scope: engine/game/water.ts, engine/game/defs/sea.ts
concepts: [steepness, swell, wavelength, feel, override]
---

Every sea in this engine that is QUOTED rather than grown takes its period
from a fixed steepness — `L₀ = Hs / steepness` — so the wavelength grows with
the height. That is fine over the band each dial was tuned on and wrong the
moment a dial reaches past it. R36 let the groundswell be asked for at twenty
metres; at `swell.steepness` = 0.035 that came out as a **570 m wave with a 1°
face**, which is the exact fault the dial was lowered from nature's 0.008 to
cure, arriving again at the other end of the band. The lab said `Hs 14.00 m`
and the picture showed a plane that slowly tilts.

The tell is in `make waves`' spectrum block, not in the header: the header's
`Hs` is honest and reassuring, while the `λ` column and the transect's `H/λ`
are where the sea stops being a sea. **Read the wavelength against what a
rider can SEE** — past a couple of hundred metres the crest ahead and the
crest behind are both off screen — rather than against the height.

The fix is a LENGTH cap taken after the steepness draw, not a steeper dial:
`steep = max(quoted, hs / maxLength)`. 220 m is the length `sea.steepness`
(the open ocean's storm) gives at the top of the dial, so the two dials meet
there and the biggest swell is quoted at the storm's own shape — and nothing
under 7.7 m moves at all, which kept every sea the generator had ever dealt
byte-identical.
