---
title: Steepness is what reads as a wave, not height — and it is bought from the ride, so measure with `make sim` before believing a picture
date: 2026-09-09
scope: engine/game/defs/tuning.ts, engine/game/water.ts
concepts: [steepness, feel, sim, tuning]
---

What the eye reads is the FACE, and the face's angle is `Hs/L₀`, not `Hs`. A real twenty-metre sea is a five-hundred-metre swell with a ten-degree face — at sea you feel it, from a boat you cannot see it — so `steepness` (the quoted sea's period, and so its wavelength) does more for a monster wave than any amount of height: the same 20 m sea went from 8.5 m of wave at 9.8° to 14.7 m at 32° on that dial alone. The wind sea has the same pair, `heightScale` and `periodScale`, and steepness goes as `heightScale / periodScale²` — so shortening the wave is doubly strong and doubly expensive, because it raises the encounter rate as well as the angle. 1.8 / 0.85 (2.5× natural) photographed beautifully and was unridable: the bot spent 78 s of a 245 s run airborne on 76 launches and `make sim` fell from 16/16 finished to 12/16. 1.5 / 1.0 keeps 16/16 with air up from 13 to 18 s/run. **Prefer height over shortness, and never accept a sea on the screenshot alone.** Keep the quote clear of Michell's 1/7 too: a sea sitting on the breaking limit is one the renderer foams over its whole face, and it comes out a snowfield.
