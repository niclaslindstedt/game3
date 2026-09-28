---
title: Judge a model against the code's in --mode free — the staged race scenes stand a rival on the player's own spot
date: 2026-09-28
scope: scripts/screenshot.mjs, pwa/src/game/craft-models.ts
concepts: [screenshots, models, comparison]
---

`make screenshots --scene cruise` (and `rest`) in a RACE put a rival's hull
at the player's own x and z, a few centimetres lower — in the code-built
build as much as in the modelled one. Two identical faceted hulls on one
spot read as one; a modelled craft over a code one, or two modelled riders a
hand apart, read as a double image that looks like a bug in the model. Take
every before/after pair with `--mode free` (no field), and walk the scene's
`craft` / `field` groups before blaming a hang or a clone.
