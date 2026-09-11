---
title: A speed class has to scale the ENGINE as well as the gearing, be quoted in the speed it buys, and live in the SPEC rather than in a global
date: 2026-09-10
scope: engine/game/defs/craft.ts, engine/game/defs/tuning.ts
concepts: [tuning, measurement, performance, craft]
---

Three things, learned in that order, about making the whole roster faster together.

**Scale the engine too.** A waterjet's load torque goes as pitch³ at a given
shaft speed, so a taller impeller alone just bogs the motor: measured, a class
of 2 left the roster's FASTEST craft slower than class 1 (dart 78 → 51 km/h).
`craftAtClass` grows the torque curve and `powerKw` by pitch³ beside the pitch.

**Quote it in what it BUYS, not in the pitch.** Speed goes as pitch^1.2 — a
planing hull lifts as it speeds up, its wetted area shrinks, its drag grows
slower than v² — so a knob spelled as pitch delivers 1.66× when it says 1.5.
Derive the pitch from the promise (`class^(1/classGain)`), and the knob is
honest to 2–4 % over 0.75–2.

**Put it in the SPEC, not in a global.** The first cut applied it inside
`topSpeedOf` off a `TUNING` constant, which meant every other reader — the
pump, `jetCeiling`, the bot, the HUD's dial, the craft card's spec sheet — had
to be taught about classes one at a time, and any that was missed disagreed
silently. `craftAtClass(spec, class)` returns a spec with the taller pump and
the numbers it actually has; everything downstream reads a spec and knows
nothing about a class, so two readers cannot drift. It also makes the class a
per-RUN choice rather than a build-wide one, which is what let it become a
row on the craft card.
