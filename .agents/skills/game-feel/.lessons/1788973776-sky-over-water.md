---
title: Over open water a sky is only half the picture — the sea must reflect the SAME sky, and the horizon band under a lid is the ceiling's own lit rim
date: 2026-09-09
scope: pwa/src/game/sky.ts, pwa/src/game/sky-glsl.ts, pwa/src/game/water-shader.ts
concepts: [sky, weather, water, horizon, clouds]
---

Two things the screenshots caught that the numbers could not, both specific
to a game whose horizon is water for 360°:

**The sea reflects the sky, so a fixed water tint reads as a pasted-on sky.**
A sunset over the palette's teal is the single loudest way a good sky can look
wrong. The answer is not a second gradient handed to the water: it is ONE
function, `skyAlong` in `sky-glsl.ts`, that the dome is painted with and the
water reflects, off one shared bundle of uniforms. Two descriptions of the
same sky could not stay in step for an afternoon; there is now only one, and
what differs between the two callers is what each was COMPILED for
(`SkyBuild`).

**Under a lid the horizon band IS the lit rim.** The ceiling's rim stands a
fraction of a degree above the eye, so there is always open sky between it and
the water. Leaving that sliver on the hour's own horizon paints it a different
colour from the strip right above it and rules a hard band across the skyline;
`lidded()` sets `p.horizon = deck.rim` so they are one colour.

With no ridge line to hide any of it, both show far more here than they would
over land.
