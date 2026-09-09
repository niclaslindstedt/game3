---
title: Over open water a sky is only half the picture — the sea must reflect the same preset, and anything hung under a cloud deck must follow the deck's sag
date: 2026-09-09
scope: pwa/src/game/sky.ts, pwa/src/game/clouds.ts, pwa/src/game/water-mesh.ts
concepts: [sky, weather, water, horizon, clouds]
---

Three things the screenshots caught that the numbers could not, all specific
to a game whose horizon is water for 360°:

**The sea reflects the sky, so a fixed water tint reads as a pasted-on sky.**
`seaReflection(preset)` is the sky as a gradient the water's shader reflects
per wave face (and `seaMirror(preset)` the one grazing colour the horizon
disc takes); `water-mesh.ts` is handed the preset through `retone` and picks
nothing of its own. A sunset over the palette's teal is the single loudest
way a good sky can look wrong.

**Anything hung under a cloud ceiling must read the ceiling's own SAG at its
own distance,** not a share of the height overhead. The deck's base falls away
toward the rim (`DECK_SAG`), so scud hung at 0.4× the overhead height two
kilometres out comes down ONTO the skyline and reads as flat white lenses
floating on the water. `deckHeightAt(base, out)` in `clouds.ts` is the one
curve both the mesh and the scud read.

**Under a lid the horizon band IS the lit rim.** The ceiling is a real surface
whose rim stands a fraction of a degree above the eye, so there is always open
dome between it and the water. Leaving that sliver on the hour's own horizon
paints it a different colour from the strip right above it and rules a hard
band across the skyline; `lidded()` sets `p.horizon = deck.rim` so they are
one colour.

With no ridge line to hide any of it, all three show far more here than they
would over land.
