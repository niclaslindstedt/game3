---
title: A medium modelled as attenuator AND lowpass must not do both to the same layer — and check it reaches the NOISE layers too, or the mix becomes hiss by construction
date: 2026-09-16
scope: pwa/src/game/audio/engine-voice.ts, pwa/src/game/audio/water-voice.ts
concepts: [engine, beds, layers, mixing, water]
---

`SUBMERGED` held the hum and its octave to 0.35 of their level whenever the
exhaust was under water — which is nearly the whole of a run — while the
hum's cutoff was ALREADY being crossfaded to 45% of its brightness on the
same reading. Water is both, but the two halves were being charged for
twice, and the level half is the one that does the damage: what water mostly
takes off a submerged source is the top of its note, not its body.

The compounding fault is which layers the duck reached. Every PITCHED layer
was behind it and not one NOISE layer was — the intake, the spray and the
wind kept all of theirs. So the ordinary state of a run was an engine with
two thirds of its body gone under a hiss at full level, which no amount of
retuning a def fixes because it is the crossfade's shape, not a balance.

When a bed models a medium, check the two questions separately: is the
attenuation saying something the filter is not, and does it apply to every
layer the medium is actually between the ear and? A duck that covers only
half the spectrum is not a duck, it is a tilt.
