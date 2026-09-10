---
title: A thumb zone measured in % cannot clear HUD furniture measured in px — hit-test it with elementFromPoint, don't eyeball it
date: 2026-09-10
scope: pwa/src/styles.css, pwa/src/game/hud-touch.tsx
concepts: [touch, zones, layout, hit-testing, portrait, overlays]
---

The touch zones' top is a fraction of the viewport; everything they have to
clear — the top-right cluster, the RESET button, the new-build mark hanging
under the cluster in portrait — is clamped rem, so it is a FIXED pixel
height. The two scale opposite ways: the shorter the screen, the further the
zone climbs into the cluster. At the shipped 390×844 the old 22% cleared the
mark by 14 px and looked fine; at 375×667 it covered it completely, and a tap
meant for the button opened the throttle. Any zone top written as a
percentage carries this bug in it — pick the fraction against the SHORTEST
viewport the sweep looks at, not the tallest.

**A screenshot cannot answer this question.** Overlap is invisible: the zones
draw nothing until a thumb is down, so the picture shows a button sitting in
clear sky whether or not the glass in front of it is eating the press. Ask
the DOM instead — box the button with `getBoundingClientRect`, then
`document.elementFromPoint` at its centre and its corners, and read what
comes back. `?update=1` forces the new-build mark so it can be probed at all.
Two traps in that probe: `__SH_READY__` flips a frame before the first HUD
snapshot lands, so wait on `document.querySelector('.hud')` rather than the
ready flag; and a round button's corner points legitimately fall outside its
own shape, so probe down the centreline, not the corners, when the question
is stacking.

The geometry is only half the fix. `.hud-touch` is a LATER sibling than
`.hud-topright`, so with both at `z-index: auto` the zone wins the hit test
wherever they overlap, however the clearance is tuned. `z-index: 1` on the
pressable cluster makes the invariant structural instead of arithmetical, and
costs nothing: the readouts are `pointer-events: none`, so raising them
steals no press from the glass.
