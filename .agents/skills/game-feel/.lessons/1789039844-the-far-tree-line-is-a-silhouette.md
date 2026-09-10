---
title: The far tree line is a shore's silhouette against the SKY, so the fog's authored end is not a free cull distance — a cut inside the fog has to pull the fog IN to cover it, which is what the DISTANCE row's haze does
date: 2026-09-10
scope: pwa/src/game/flora.ts, pwa/src/game/settings-video.ts, pwa/src/game/draw-distance.ts, pwa/src/game/environment.ts
concepts: [flora, fog, horizon, culling, distance, silhouette]
---

Three's linear fog paints anything past `fog.far` in the fog's own colour
exactly, which reads as "a tree past the fog costs its vertices for
nothing". It does not: the tree line stands on the terrain's skyline, and
the sky above the skyline is the horizon gradient, not the fog colour — so a
fog-coloured wood is still a dark rim on a lighter sky, and at a kilometre it
is most of what says the coast runs on past the course. A cover culled at
the sky's own `fogFar` (in the cruise scene's rain the fog closed at about
300 m) drew the whole far shore out of the picture, and only a pixel diff
caught it. The honest version is the DISTANCE row's (`DISTANCE_LOOK`): every
stop pairs its radii with a `haze` that multiplies the preset's fog range,
so the cut sits inside fog that has closed over it — the picture changes
into a hazier day, which is a trade the rider chooses, never a default the
sky's own range silently makes.
