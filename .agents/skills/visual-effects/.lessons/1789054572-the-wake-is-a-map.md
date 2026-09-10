---
title: Foam behind the craft only matches the sea when the water shader draws it — rasterise the wake into a map and read it there, never lay a second material on the surface
date: 2026-09-10
scope: pwa/src/game/wake.ts, pwa/src/game/wake-profile.ts, pwa/src/game/water-shader.ts
concepts: [wake, foam, shader, render-target, churn, reference]
---

A foam ribbon over the water is a second material pretending to be the
first: it is unlit while the sea is lit by two lights, its tile is read
in another space, and it cannot bend the reflection under it. It reads as
paint at any hour and as a grey strip at dusk. What works is a MAP:
`wake.ts` rasterises the trail from straight above into a 512-texel
render target round the craft (foam, churn, crest, hollow — one channel
each, additive), and `water-shader.ts` reads it per vertex and per pixel:
the road goes through the same lace as a whitecap, the churn bends the
mirror and the glint, the relief is added to the engine's own surface
and its slope to the wave's normal, and Gerstner's horizontal term along
the map's gradient pushes the surface aside. The reference is the aerial
photograph of a runabout: a beam-wide road that stays white for a few
seconds and breaks into patches, a boil at the transom, and a pale V at
Kelvin's angle whose width is the SPEED — `wake-profile.ts` holds each.

Three traps, each of which cost a build. **The mark material must be
double-sided**: a ribbon's winding in plan turns with the heading and
folds over on the inside of a turn, and single-sided the map came back
EMPTY, with the rooster tail's droplets falling in a line that looked
like a faint road. **The churn must not close the window**: an alpha
term of half a churn turned the whole fan into a milky white cone, for
exactly the reason `CLOSED_BED` exists — the near sea's tone is the dark
bed through it. **The foam gain wants to sit under the lace's saturation**
(1.35): past it a fresh road is a flat white blanket at close range, and
the two-octave tile read is invisible. When a map effect looks wrong,
paint its raw channels onto the water in a diagnostic build before
touching a number — one shot said "empty" where five tuning rounds had
guessed.
