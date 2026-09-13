---
title: A control read off an input's SHAPE needs THREE things — a gate at the TOP of the axis, an ARMING for what a flight inherits across the launch, and an input ramp that can actually reach the gate
date: 2026-09-13
scope: engine/game/strokes.ts, engine/game/craft.ts, pwa/src/game/input-model.ts
concepts: [flight, air, dead-band, arcade, game-feel, tuning, input]
---

`strokes.ts` earns a stroke off the SHAPE of an input rather than its value.
Three separate rules are needed and each was learned by shipping without it.

- **The gate belongs at the TOP of the axis**, not in a dead band near the
  bottom. A low threshold cannot tell a trick from a trim, because a rider
  crossing a real sea trims constantly — a touch back over a crest, a touch
  forward down its face, a touch of lock to hold a line. `pumpGate` 0.8 /
  `whipGate` 0.85 with the stroke ALL-OR-NOTHING on each crossing is what
  separates them: maxing an axis is a thing nobody does by accident.
- **Arming across the launch is a second rule the gate cannot do.** Every
  step the hull has something under it re-arms the crossing: cleared on a
  ramp's deck (so a hold up it is the backflip, paid at the lip), marked
  already-made on the water (so the same hold off a crest buys nothing).
  Arm on `!c.airborne`, never `!flying` — `flying` needs `minAir`, so ~24
  steps of every flight have no contact and re-arming there takes a rider's
  own throw back off him. Read the deck off `contact.onRamp`, never
  `overRamp`, which is true for a hull merely flying across the footprint.
- **A gate at the top of an axis is only reachable by the ramp that feeds
  it**, and that ramp lives in the app (`KEY_LEAN_ATTACK`), which the engine
  cannot import. A key reaches the end of a soft ramp only by being HELD
  there, so raising the gate without quickening the ramp silently takes the
  trick away from every keyboard rider. Hold the pair with a test that reads
  both (`tests/input_model_test.ts` against `TUNING.flight.pumpGate`).

Bench it on a real sea (`syntheticLevel({ windSpeed: 12, depth: 25 })`),
holding one axis for thirty seconds. A ramp bench cannot show any of it.
