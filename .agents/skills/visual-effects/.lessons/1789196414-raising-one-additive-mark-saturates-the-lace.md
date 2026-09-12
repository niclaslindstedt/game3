---
title: Raising ONE contributor to the wake's map saturates the lace where the marks overlap — the blanket appears somewhere you did not touch
date: 2026-09-12
scope: pwa/src/game/wake-profile.ts, pwa/src/game/wake.ts, pwa/src/game/water-shader.ts
concepts: [wake, foam, shader, saturation, render-target, screenshots]
---

The map's marks blend ADDITIVELY, and the shader's lace is
`smoothstep(1 - foam, 1.35 - foam, tile)`: at a summed share near 1 the
window is `smoothstep(0, 0.35, tile)` and the whole tile passes — a flat
white blanket with no texture at all. So raising the fan's own foam (0.4 →
0.8, to stop it reading as a grey smear) turned the ROAD into a blanket,
because the fan's rails at the transom are laid on top of it: the fault
appeared in the mark that had not changed.

Two things came out of it, both worth reusing:

- **A mark that overlaps another needs a RISE, not a lower strength.** The
  fan's rails have not separated from the boil at the transom — they are
  buried in the road there and add nothing but saturation — so they ramp in
  over half a second. That is physically true as well as cheap, and it keeps
  the fan loud where it is actually visible.
- **A fade power under 1 is what makes a blanket WIDE.** Holding a road near
  full for two seconds to make it long-lived is the same saturation spread
  down the trail. Keep the power above 1 (steep off the peak, long pale
  tail) and buy the length from the LIFE instead.

Neither read at 1280 px. Both were obvious on the first 3× device-scale
capture clipped to the stern — which is the shot to take FIRST after moving
any foam number, not after five rounds of tuning.
