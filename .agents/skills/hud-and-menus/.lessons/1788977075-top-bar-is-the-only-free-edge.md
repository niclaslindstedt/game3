---
title: The top-right cluster is the only edge free for a new HUD element, and in portrait a fourth thing there has to hang UNDER the row
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

At 390 px portrait that row has about 40 px of slack between the gate count
and the wind vane: one 2 rem chip pushes the vane into `0 / 14`, and anything
that widens on press (the new-build button becoming the word RELOAD) collides
outright. The fix that works without magic numbers is to take the new item out
of the flow in the portrait media query and hang it under the cluster —
`.hud-topright` is already `position: absolute`, so `position: absolute; top:
100%; right: 0` on the child follows the vane's clamp-driven height instead of
restating it, and a widening press then opens leftward into empty sky.

Measure this by looking, not by arithmetic: `--viewport phone` on
`scripts/screenshot.mjs`, plus 375×667 (the SE class, tighter than the shipped
portrait viewport) and 844×390. A playwright scratch script that clicks the
element and re-shoots is the only way to see a pressed/armed state at all —
the screenshot tool photographs the idle frame.
