---
title: The thumb zone's top is DERIVED from the top-right cluster, never a fraction picked to clear it — and only a DOM hit-test can tell you it does not
date: 2026-09-10
scope: pwa/src/styles.css, pwa/src/game/hud-touch.tsx
concepts: [touch, zones, layout, hit-testing, portrait, overlays, minimap]
---

The zones' top was once a bare fraction of the viewport, while everything
they must clear — the top-right cluster and its two presses — is clamped rem,
a FIXED pixel height. The two scale opposite ways: the shorter the screen,
the further the zone climbs into the cluster. At 390×844 the old 22% cleared
the cluster's foot by 14 px and looked fine; at 375×667 it covered it
completely, and a tap meant for a button opened the throttle.

`.hud-zone`'s top is now `max(40%, …)` over the cluster's OWN arithmetic —
the top inset, `--hud-map`, the gap the presses hang on, and half a map for
the presses. The fraction is only a floor. This matters because the whole
corner is sized from `--hud-map` and nothing else: the cluster is a map and a
half tall, so raising the map a third pushes the presses ~50 px down and
straight into the lever zone on a phone on its side. Resize the map and the
clearance follows; do not re-pick a percentage.

**A screenshot cannot answer this question.** Overlap is invisible — the
zones draw nothing until a thumb is down, so the picture shows a button in
clear sky whether or not the glass in front of it is eating the press. Ask
the DOM: box the element with `getBoundingClientRect`, then
`document.elementFromPoint` down its CENTRELINE (a round button's corners
legitimately fall outside its own shape). `?update=1` forces the new-build
mark so it can be probed at all, and `__SH_READY__` flips a frame before the
first HUD snapshot, so wait on `document.querySelector('.hud')` instead.

Geometry is only half of it, and for a control that stands INSIDE a zone on
purpose — the new-build mark in the bottom-right corner — it is the whole of
it. `.hud-touch` is a LATER sibling than every readout cluster, so at
`z-index: auto` the zone wins wherever they overlap, however the clearance is
tuned. `z-index: 1` on the container (`.hud-topright`, `.hud-right`) makes
that structural, and the probe above is what proves it.
