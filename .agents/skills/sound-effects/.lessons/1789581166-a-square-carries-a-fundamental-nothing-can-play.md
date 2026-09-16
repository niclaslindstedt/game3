---
title: A driven SQUARE under a lowpass is how a sub-audible fundamental stays audible — the odd harmonics carry it, and the cutoff decides hum or buzz
date: 2026-09-16
scope: pwa/src/game/audio/engine-voice.ts, pwa/src/lib/voice.ts
concepts: [engine, beds, layers, mixing, pitch]
---

A three-cylinder four-stroke idles at a 38 Hz firing note. No phone, no
laptop and no pair of earbuds reproduces that, so an engine written as a
triangle or a sine at its own note simply does not exist at idle — which is
exactly where a player first hears it, sat on the water doing nothing.

The fix is not to pitch the layer up and lie about the revs. It is a
`square`: its odd harmonics land at 3, 5 and 7 times the note, so 38 Hz puts
real energy at 112, 187 and 262 Hz where every speaker lives, and the PITCH
the ear reads is still the true one. A lowpass over it is then the whole
difference between a machine in the background and a buzz in the front — the
`motor` layer sits at 190 Hz at idle opening to 360 Hz at the limiter, and
past a few hundred Hertz a square stops being furniture.

The same reach works for anything with a fundamental under ~80 Hz. The
`bass` layer beside it takes the other route — a sine with a hard floor
(`BASS_FLOOR_HZ`) — and the two are not interchangeable: a floored sine lies
about the pitch to stay audible, a square tells the truth and lets its
harmonics do the carrying.
