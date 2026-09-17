---
title: A grade's contrast and lift belong in a `sqrt` coordinate, not in linear light — and both that coordinate and the saturation need a clamp, because each drives a channel NEGATIVE and the square puts the sign back
date: 2026-09-17
scope: pwa/src/game/colour-grade.ts, pwa/src/game/grade-pass.ts
concepts: [colour, shader, three, grade, biome]
---

A contrast applied as a gain about mid grey in LINEAR light is not a
contrast: mid grey is 0.18, so everything under a quarter of the range is
crushed into the black, and the sun's glint — a linear 4 with no tone mapping
over it — runs away past 5. `sqrt` is the cheap honest stand-in for the
display curve (gamma 2 against sRGB's 2.4, a difference nobody can name), and
a gain about `sqrt(0.18)` in it is the lift-and-gain a grading desk has. One
`sqrt` and one multiply per pixel.

Both clamps in `gradeTone` / the fragment shader are load-bearing, and each
was found by a case rather than by reading:

- **Before the square.** A contrast over 1 takes the coordinate NEGATIVE for
  anything darker than mid grey by more than the gain, and squaring a
  negative flips it. Pure black came back at 8/255 — a grey veil over the
  whole night, from the dial meant to crush it. The monotonic-ramp case is
  what fails first; a lightness assertion on black is what names it.
- **After the saturation.** A saturation over 1 drives the weakest channel of
  an already strong colour below zero: a turquoise sea has almost no red in
  it. The write to an 8-bit target clamps anyway, so the picture survives —
  but the split-tone weight downstream is then read off a colour that does
  not exist.

Order is the desk's: contrast, then lift (lifting first only hands the
contrast something to put back), then saturation, cast, split.
