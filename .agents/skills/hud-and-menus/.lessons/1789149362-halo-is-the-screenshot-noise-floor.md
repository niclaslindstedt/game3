---
title: The minimap's next-gate halo is the noise floor of every screenshot diff — a 25×25 box, up to 138/255, between two shots of the SAME build
date: 2026-09-11
scope: pwa/src/styles.css, scripts/screenshot.mjs
concepts: [screenshots, minimap, verification, determinism]
---

A run is deterministic per seed, so two `make screenshots` of one build at one
`?hour=` should be byte-identical — and they are not. `.hud-minimap-halo` is an
infinite CSS animation on whichever gate is next, and it lands wherever the
capture happens to catch it: between two shots of the same build it moved 287
pixels by as much as 138/255, all inside one 25×25 box in the map.

That number is the floor, and knowing it is what makes a pixel diff a useful
assertion rather than a shrug. It is the cheapest proof a HUD change left the
DAY picture alone while changing the night one: shoot the same scene at a
bright hour before and after, diff, and expect a difference CONFINED to the
halo's box. On this change that caught a real slip — unifying two white-edge
alphas (65% on a button, 70% on a gauge track) into one token had moved the
noon frame's rev bar and button rims; splitting the token back into
`--hud-edge` and `--hud-track` took the daylight diff back to the halo alone.

The probe is a dozen lines of `playwright-core` reading both PNGs into a
canvas in Chromium and reporting the count, the max channel delta and the
bounding box. It must live inside the repo tree (`previews/` is gitignored) or
Node cannot resolve `playwright-core` from the script's own directory.
