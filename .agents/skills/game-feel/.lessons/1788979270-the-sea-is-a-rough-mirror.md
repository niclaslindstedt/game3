---
title: The water reflects a BLURRED sky — widen any sharp feature of the sky (a squall's lit rim) before the shader reflects it, or it lands as hard white streaks that read as foam the sea does not have
date: 2026-09-09
scope: pwa/src/game/sky-glsl.ts, pwa/src/game/water-shader.ts
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
what it reflects is the sky blurred by a few degrees.

The water's copy of `skyAlong` is compiled with that blur baked in
(`SkyBuild`): a rim band 2.5× the ceiling's own (`MIRROR_RIM`), a wider ramp
where the ceiling closes over the sliver under its base, softer cloud edges
and two octaves fewer. The squall then reads as a silver sea under a black lid
rather than a foam field. Two more that belong to the same fault: reflect off
a normal that keeps only about a THIRD of the ripple tile's slope (the
reflection is resolved per pixel while the ripples are a minified texture, so
the full slope turns a cloud edge into aliasing), and keep any RESOLVED
geometry — the rain's rings — at its full slope in that same normal, because
under a rain deck there is no beam to glint and the mirror is the only place a
dimple can show at all.

Check a suspected foam fault against the foam's INPUT (the colour alpha the
CPU loop writes) before touching the foam.
