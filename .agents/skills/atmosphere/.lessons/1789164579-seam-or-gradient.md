---
title: Tell a seam from a steep gradient by HALVING the sample spacing — a gradient's step shrinks with it, a discontinuity's does not
date: 2026-09-11
scope: pwa/src/game/sky-glsl.ts, pwa/src/game/starfield.ts, pwa/src/game/cloud-field.ts
concepts: [sky, shader, night, debugging, measurement]
---

"I can see a seam" is a claim about a step between two neighbouring pixels,
and the eye cannot tell one from the band's own edge — both look like a line.
Sweeping the sky at one resolution cannot either: a scan of the Milky Way at
seed 38's autumn 21:00 named two suspects, azimuth 336° and azimuth 150°,
both around ten times the typical neighbour step.

Quadruple the sample count and the answer is unambiguous. The step at 150°
fell from 0.0174 to 0.0043 — exactly a quarter, so it is a GRADIENT, the band
crossing the sky, and nothing is wrong with it. The step at 336° held at 0.05
whatever the spacing, because a discontinuity has no width to resolve. That
one was the seam.

Do it on the CPU, not in a screenshot: port the shader's function (it is a
pure function of a direction), walk a circle of constant elevation, and print
the worst neighbour step against the mean. It runs in a second, it says WHERE
the seam is in azimuth and elevation, and it gives a before/after number that
a picture of a dark sky cannot. The same scan is the proof the fix worked —
after it, every step scaled with the spacing.

One trap: exclude the near-black samples from the "typical" step or the mean
is dominated by empty sky and every real feature looks like a seam.
