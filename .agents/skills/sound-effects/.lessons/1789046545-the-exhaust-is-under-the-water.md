---
title: "The exhaust exits BELOW the waterline — mix the engine as two voices either side of it, not as one loudness with the air as an exception"
date: 2026-09-10
scope: pwa/src/game/audio/engine-voice.ts, pwa/src/game/audio/ride-bed.ts
concepts: [engine, exhaust, beds, mixing, layers, water]
---

Reported as "too loud — maybe only heard when airborne, and just splashing
underwater". Literally that is a silent engine for most of a run, which is
wrong; as a description of what a jet ski sounds like it is exactly right. A
runabout's pipe exits below the boot, so for nearly a whole run the engine is
heard THROUGH water — an attenuator and a lowpass both — which is why one
that deafens on a trailer is a burble from a beach, and why it CRACKS when it clears a wave.

The reading is `exhaustClear(wetted, airborne, capsized)`: the dry share of
the bottom, CUBED, because the pipe is low and aft and the last thing to
clear. Measured, it runs ~0.001 at rest, 0.03 at half throttle, 0.24 at full
plane, 1 in the air — which keeps the ordinary riding band at the quiet end.
Capsized is 0, not 1 — bottom in the air, pipe under it.

The shape worth copying: the layers do NOT all scale together. Combustion
takes `SUBMERGED + (1−SUBMERGED)·clear`; the exhaust's EDGE (the rasp) far
more (0.15 + 0.85·clear — there is no edge in the air to hear); the BASS
least (0.75 + 0.25·clear — the block is bolted to a hull, and a hull is a
drum); and the hum's CUTOFF is scaled too, which is most of the perceptual
change: a submerged engine is DARKER, not just quieter. The wet blat inverts
— scaled by `1 − clear`, only SHAPED by the revs — so a pipe under water goes
from an idle knock to a hard wet tearing instead of being blown clear at
mid-band, and the engine has something to BE while the water holds it down.

On the bench: the engine down ~5 dB across the riding band, untouched in the
air; the meter's beds down 1.5–3.1 dB with "in the air" at +0.0. The beds
moving far less than the engine is right — the sea should be the loudest
thing in a game about water. `SUBMERGED` (0.35) is the knob for more.
