---
title: The top-right cluster is the only free edge for a new HUD element — never the build corner, which is under the speedo — and in portrait it has to hang UNDER the row
date: 2026-09-09
scope: pwa/src/game/hud.tsx, pwa/src/styles.css
concepts: [layout, portrait, placement, overlays]
---

All four corners of this HUD are already spoken for: the clock and the gate
count top-left, the wind vane and RESET top-right, the rev bar, the speed and
the build stamp bottom-left, the air time and the news column bottom-right —
and on a phone the lower half is the two thumb zones, so nothing pressable may
go there. Anything new therefore joins `.hud-topright`, which is where the
sibling game's bottom-corner placements have to be re-argued rather than
copied.

THE BUILD CORNER IS NOT THE SPARE ONE, however small the thing is. `.hud-build`
sits directly under the speed cluster, and a second line in it lands across the
speedo at 390 px portrait — that is where the frame-rate and frame-cost
readouts went first, and it took a shot to see. They belong UNDER THE MINIMAP,
as a `.hud-meters` column right-aligned inside `.hud-topright`: stacked rather
than in a row (the cost line is long and the map is narrow, and a line growing
leftward is a readout wandering over the water), and in
`font-variant-numeric: tabular-nums`, without which a rate crossing 99 → 100
shifts everything beside it several times a second.

At 390 px portrait that row has about 40 px of slack between the gate count
and the wind vane: one 2 rem chip pushes the vane into `0 / 14`, and anything
that widens on press (the new-build button becoming the word RELOAD) collides
outright. The fix that works without magic numbers is to take the new item out
of the flow in the portrait media query and hang it under the cluster —
`.hud-topright` is already `position: absolute`, so `position: absolute; top:
100%; right: 0` on the child follows the vane's clamp-driven height instead of
restating it, and a widening press then opens leftward into empty sky.

Measure by looking: `--viewport phone`, plus 375×667 (the SE class) and
844×390. A scratch playwright script is the only way to see a pressed or armed
state, or a readout no URL parameter turns on — the screenshot tool
photographs the idle frame off the stored settings blob.
