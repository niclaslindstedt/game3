---
title: A new READOUT joins the column its SUBJECT already lives in — and in `.hud-top` that means the SUN CLOCK'S line, because the run clock's is full at three on a phone
date: 2026-09-09
scope: pwa/src/game/hud.tsx, pwa/src/styles.css
concepts: [layout, portrait, placement, overlays]
---

The census: the clock and the gate count in the top-left column's first line,
the SUN'S CLOCK and how far offshore on its second (`.hud-top` — the run's
facts, stacked); the minimap, the three presses and the diagnostics top-right
(`.hud-topright`); the air clock top-CENTRE (`.hud-air`, which appears only in
flight); the altitude tape and WIND METER over the rev bar and speed
bottom-left; the build stamp under that cluster; the news column bottom-right
— and on a phone the lower three fifths is the two thumb zones.

A new readout joins the column whose SUBJECT it shares, and for a fact about
the RUN that is `.hud-top`. The trick score's total went there, under the sun
clock; the combo it comes from went into `.hud-air` beside the seconds that
earned it.

WHICH LINE OF `.hud-top`, THOUGH, IS DECIDED BY THE FIRST ONE BEING FULL.
`.hud-top-row` — the run clock's line — holds THREE at 390 px: a race already
has the clock, the place and the gate count across it, and a fourth chip put
there (the metres from shore) pushed the gate count under the minimap's
plate, clipped, with nothing on screen saying so. The SECOND line is the one
with room — it clears the map's square, and it is where the sun clock already
sits — so a new readout beside the hour costs nothing and needs no CSS at
all, while the same readout beside the run clock costs a wrap rule and a
width held off `--hud-map`. Shoot BOTH viewports before believing any of
this: the desktop shot of the crowded version looked perfect.
