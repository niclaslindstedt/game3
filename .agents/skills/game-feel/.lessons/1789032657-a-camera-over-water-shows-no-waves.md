---
title: A lens over the deck shows no waves — a swell only reads as a swell from a camera looking ACROSS it, so an overhead rung is judged by the WAKE instead
date: 2026-09-10
scope: pwa/src/game/camera-rigs.ts
concepts: [camera, ladder, waves, framing, reference, drone]
---

The sibling rally game's camera ladder ends with a `top` view twenty metres
over the roof, and it works there because a road is a ribbon seen from above.
Ported straight across it fails on its own terms: from over the deck the sea
has no silhouette at all — no crest against sky, no face coming at the hull —
and retuning the height only trades an empty frame for a closer empty frame.
The fault is the angle, not the number. **The swell is only legible from a lens
looking across it**, which is why `heli` (9 m up, 16 m back, the craft three
quarters down the frame with the horizon in the top third) is the furthest the
ladder goes while still being about the water's SHAPE.

The same reading is what the two rungs at the other end are worth: `bow`, out
on the foredeck with the eye 0.6 m over the deck, is the best wave view in the
game because the next face fills the screen from below.

**`drone` is the deliberate exception, and it earns its place by not competing.**
Straight down from 18 m it shows none of the above and instead shows what every
other rung foreshortens to a stripe: the wake's V opening behind the transom,
the road's width, the line taken between two buoys, the wind's streaks across
the surface. It is good in daylight and thin at dusk, because at a near-vertical
angle the Fresnel gives almost nothing back and the picture is the water's body
colour alone.

The rule to carry into any new rig here: **judge a camera by what has a SHAPE in
it, and say which.** For a rung looking across the sea that is a crest and a
horizon — `make screenshots SCENE=carve CAMERA=<rung>` names the file after the
rung, so the whole ladder lays side by side. For one looking down it is the
trail: shoot `SCENE=cruise --t 8` so there is a wake to see at all.
