---
title: A hit that "sounds like a synth" is a PITCH GLIDE plus a highpassed transient — a struck body holds its note, and the crack is broadband
date: 2026-09-16
scope: pwa/src/game/audio/bank.ts
concepts: [bank, one-shots, transient, drive, impact]
---

`hit_rock` read as an arcade zap rather than a collision, and the two causes
are both general to any struck-body sound in this bank:

- **The glide.** A driven square running 190 → 85 Hz over 230 ms is a
  cartoon boing. Two hard things meeting do not change pitch: a hull is a
  hollow shell and it BOOMS at its own note. A driven sine that barely moves
  (146 → 122 Hz) with a lowpass over it is the body; the drive is what keeps
  it from being a bell. Keep the echo send on the CRACK, not on the low
  tone — a low boom with a tail on it is the boing again.
- **The highpass-only transient.** A crack filtered above 2.4 kHz is a hiss.
  An impact between hard things has energy everywhere at once, so the
  transient is white noise with only the rumble taken off (a highpass around
  250–400 Hz) and gone inside 20 ms. The low half of the spectrum is what
  says the two things were heavy.

And the thing a collision needs that a splash does not: the GRIND. A hull
does not just strike stone, it drags off it — white noise through a bandpass
whose cutoff falls (2.9 kHz → 620 Hz over ~250 ms), delayed a few tens of
milliseconds behind the crack, because the scrape is what happens NEXT.

`make audition ARGS=--meter` will not catch any of this: the sound metered
−27.1 dBFS before and −27.3 after. The meter is for the mix, and a spectrum
that is entirely wrong can sit at exactly the right level. Its own run-to-run
variance is about ±1 dB on every row, so read a single row's move of less
than that as noise.
