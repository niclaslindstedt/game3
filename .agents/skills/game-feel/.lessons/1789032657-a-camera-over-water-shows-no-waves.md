---
title: A lens over the deck shows no waves — a swell only reads as a swell from a camera looking ACROSS it, so the ladder stops at heli
date: 2026-09-10
scope: pwa/src/game/camera-rigs.ts
concepts: [camera, ladder, waves, framing, reference]
---

The sibling rally game's camera ladder ends with a `top` view twenty metres
over the roof, and it works there because a road is a ribbon seen from above.
Ported straight across it fails: from over the deck the sea has no silhouette
at all — no crest against sky, no face coming at the hull — and the frame is a
flat dark field with a speck on it. Retuning the height only trades an empty
frame for a slightly closer empty frame; the fault is the angle, not the
number. **The swell is only legible from a lens looking across it**, which is
why `heli` (9 m up, 16 m back, the craft three quarters down the frame with the
horizon in the top third) is the furthest back this game's ladder goes.

The same reading is what the two rungs at the other end are worth: `bow`, out
on the foredeck with the eye 0.6 m over the deck, is the best wave view in the
game because the next face fills the screen from below.

The rule to carry into any new rig here: **judge a camera by whether a wave has
a shape in it.** Screenshot it at `SCENE=carve` and look for the horizon and a
crest line. `make screenshots SCENE=carve CAMERA=<rung>` names the file after
the rung, so the whole ladder can be laid side by side.
