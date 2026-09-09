---
title: The water reflects a BLURRED sky — widen any sharp feature of the sky (a squall's lit rim) before the shader reflects it, or it lands as hard white streaks that read as foam the sea does not have
date: 2026-09-09
scope: pwa/src/game/sky.ts, pwa/src/game/water-shader.ts
concepts: [water, reflection, sky, weather, foam]
---

Under a squall the ceiling's lit rim is a strip nine degrees tall
(`RIM_BAND`). Reflected per pixel through Schlick's Fresnel exactly as the
dome draws it, every wave back whose reflection vector dips under a couple of
degrees lands on the strip and the sea comes out covered in bright bands
along the crests — indistinguishable from whitecaps at a wind that blows
none, and the first read of the screenshot was "the foam is too strong". It
was not the foam (the tilt bands foam nothing at that sea): it was the mirror
being too sharp. A real sea reflects the sky through a spread of slopes, so
what it reflects is the sky blurred by a few degrees. `seaReflection` hands
the shader the deck's gradient over `DECK_BLUR` (2.5×) the rim band with a
gentler curve, and the squall reads as a silver sea under a black lid rather
than a foam field. The open sky's gradient is wide enough to need nothing.
Check a suspected foam fault against the foam's INPUT (the colour alpha the
CPU loop writes) before touching the foam.
