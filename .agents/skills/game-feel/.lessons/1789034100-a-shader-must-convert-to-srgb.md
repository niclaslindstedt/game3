---
title: A hand-written ShaderMaterial must end with `#include <colorspace_fragment>` — and the fault does not read as "the sky is dark", it reads as a far shore glowing brighter than the sky behind it
date: 2026-09-10
scope: pwa/src/game/sky-dome.ts, pwa/src/game/sky-glsl.ts, pwa/src/game/water-shader.ts
concepts: [sky, shader, colour, three, fog, horizon]
---

`THREE.Color.set(hex)` converts sRGB→linear on the way in when colour
management is on, and three's own materials convert back at the end of the
fragment shader. A `ShaderMaterial` that writes `gl_FragColor` itself and
skips the chunk hands out a picture roughly half as bright as the one that was
authored — in mid-tones, a luminance of 145 where 216 was asked for.

**The reason it is hard to spot is that nothing looks obviously wrong on its
own.** The sky reads as "a moody sky". What gives it away is the SEAM: every
other surface in the scene converts correctly, so the far shore — which is
100% fog past `fogFar`, i.e. a flat patch of `Preset.fog` — comes out brighter
than the sky directly above it. Distance can never do that: haze can only take
a thing toward the light it is seen against. A shore, a ridge or a tree line
that out-shines its own sky is the signature; check the shader's last line
before touching a colour.

Two habits that follow: give any new sky or water shader the chunk the moment
it is written, and when a picture is "somehow flat", sample a vertical column
of pixels through the skyline (`sky` sheet, `PIL`, eight pixels apart) rather
than arguing about it — the step at the waterline is a number.
