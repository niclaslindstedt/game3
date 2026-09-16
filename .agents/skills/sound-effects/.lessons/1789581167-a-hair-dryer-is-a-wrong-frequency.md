---
title: When a bed reads as a "hair dryer", suspect a DERIVED FREQUENCY that multiplied two counts together — not the level
date: 2026-09-16
scope: pwa/src/game/audio/engine-voice.ts
concepts: [engine, beds, layers, pitch, mixing]
---

The pump's whine was `rpm / 60 × 18` — three impeller blades multiplied by
six stator vanes — and it ran to a 2.4 kHz sine at the limiter, sat on top
of the spray bed. That product is not a frequency a pump makes. What a
waterjet radiates is the BLADE PASSING tone, blades × shaft rate, three a
revolution; the vane count decides which circumferential modes escape the
tunnel (Tyler–Sofrin), not the pitch. The honest number is six times lower.

Two things generalise:

- **A frequency written as `a × b` where both are part counts is worth
  re-deriving from first principles.** It reads as physics in the comment and
  nobody questions it, and being an order out is inaudible as "wrong physics"
  and very audible as the wrong instrument.
- **Brightness belongs in the harmonic stack and the filter band, never in
  the fundamental.** A pump IS bright; the way to keep that while dropping
  the pitch six-fold is a driven sawtooth with its bandpass parked a few
  harmonics up (`WHINE_HARMONIC`), so the pitch the ear tracks is the low one
  and the glitter comes off the harmonics. Reaching for a higher fundamental
  to get brightness is what put a sine in the hiss band in the first place.
