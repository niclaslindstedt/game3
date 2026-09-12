---
title: Every corner of this HUD is spoken for — a new READOUT joins the column its SUBJECT already lives in, a new PRESS has to buy its corner, and the build corner is never the spare one
date: 2026-09-09
scope: pwa/src/game/hud.tsx, pwa/src/styles.css
concepts: [layout, portrait, placement, overlays]
---

The census: the clock, the gate count, the WIND VANE and the SUN'S CLOCK in
the top-left column (`.hud-top` — the run's facts, stacked); the minimap,
the three presses and the diagnostics top-right (`.hud-topright`); the air
clock top-CENTRE (`.hud-air`, which appears only in flight); the rev bar,
the speed and the build stamp bottom-left; the news column bottom-right —
and on a phone the lower three fifths is the two thumb zones.

A new READOUT joins the column whose SUBJECT it shares, and for a fact about
the RUN that is `.hud-top`: it stacks downward with slack to spare at 390 px
portrait, where `.hud-topright` is the crowded one. The trick score's total
went there, under the sun clock, and the combo it comes from went into
`.hud-air` beside the seconds that earned it. Shoot both viewports before
believing any of this — the census moves.

A new PRESS is the harder call, and the bottom-right corner is available to
one if it is worth the glass: the new-build mark lives there at the foot of
`.hud-right`, inside the lever's zone, keeping its press on `z-index` alone
(see the zone lesson). What buys it is that the corner is the last place a
thumb starts a downward drag from, and that the press is armed before it does
anything. Do not spend that corner twice.

THE BUILD CORNER IS NOT THE SPARE ONE, however small the thing is.
`.hud-build` sits directly under the speed cluster, and a second line in it
lands across the speedo at 390 px portrait — that is where the frame-rate and
frame-cost readouts went first, and it took a shot to see. They belong UNDER
THE MINIMAP, as a `.hud-meters` column right-aligned inside `.hud-topright`:
stacked rather than in a row (the cost line is long and the map is narrow, and
a line growing leftward is a readout wandering over the water), and in
`font-variant-numeric: tabular-nums`, without which a rate crossing 99 → 100
shifts everything beside it several times a second.
