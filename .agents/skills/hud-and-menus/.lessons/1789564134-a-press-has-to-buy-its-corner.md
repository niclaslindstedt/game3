---
title: A new PRESS has to buy its corner, and the build corner is never the spare one — a second line there lands across the speedo on a phone
date: 2026-09-09
scope: pwa/src/game/hud.tsx, pwa/src/styles.css
concepts: [layout, portrait, placement, overlays]
---

A press is a harder call than a readout, and the bottom-right corner is
available to one if it is worth the glass: the new-build mark lives there at
the foot of `.hud-right`, inside the lever's zone, keeping its press on
`z-index` alone (see the zone lesson). What buys it is that the corner is the
last place a thumb starts a downward drag from, and that the press is armed
before it does anything. Do not spend that corner twice.

THE BUILD CORNER IS NOT THE SPARE ONE, however small the thing is.
`.hud-build` sits directly under the speed cluster, and a second line in it
lands across the speedo at 390 px portrait — that is where the frame-rate and
frame-cost readouts went first, and it took a shot to see. They belong UNDER
THE MINIMAP, as a `.hud-meters` column right-aligned inside `.hud-topright`:
stacked rather than in a row (the cost line is long and the map is narrow, and
a line growing leftward is a readout wandering over the water), and in
`font-variant-numeric: tabular-nums`, without which a rate crossing 99 → 100
shifts everything beside it several times a second.
