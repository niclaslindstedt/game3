---
title: The top bar's portrait row has ~40 px of slack, so anything that widens on press has to leave the flow — hang it under the cluster, or pin it to the foot of a bottom corner
date: 2026-09-09
scope: pwa/src/game/hud.tsx, pwa/src/styles.css
concepts: [layout, portrait, placement, overlays]
---

At 390 px portrait the top-right row has about 40 px between the gate count
and the wind vane: one 2 rem chip pushes the vane into `0 / 14`, and anything
that widens on press collides outright. Two fixes work without magic numbers.

Take the item out of the flow in the portrait media query and hang it under
the cluster — `.hud-topright` is already `position: absolute`, so
`position: absolute; top: 100%; right: 0` on the child follows the vane's
clamp-driven height instead of restating it.

Or pin it to the FOOT of a bottom corner's column, which is where the
new-build mark ended up: `.hud-right` grows upward, so the mark keeps the
corner and the transient flashes stack over it — nothing that arrives ever
moves a button a thumb is on its way to, and a widening press opens leftward
into empty sky at both reference viewports.

Measure by looking: `--viewport phone`, plus 375×667 (the SE class) and
844×390. A scratch playwright script is the only way to see a pressed or armed
state, or a readout no URL parameter turns on — the screenshot tool
photographs the idle frame off the stored settings blob.
