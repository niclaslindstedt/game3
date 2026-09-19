---
title: `--surface pause` can NEVER photograph the pause card's tallest form, because `?paused=1` holds the run before a single step is recorded
date: 2026-09-19
scope: pwa/src/game/menu-pause.tsx, scripts/screenshot.mjs
concepts: [pause, screenshots, replay, surfaces, measurement]
---

The lab's `pause` surface loads `?paused=1`, which puts the card up
immediately — so `replays.offers()` is false (the tape has no steps yet) and
the WATCH REPLAY row is never in the shot. Every picture of that card is one
row shorter than the card a rider actually meets, on the one surface with the
tightest height budget in the game. A change measured against those shots is
measured against the easy case.

To reach the real card, ride to it: `?start=1&mode=race`, wait on
`window.__SH_READY__`, hold **`w`** (the throttle is `KeyW`; the arrow cluster
is the HANDLEBAR and ArrowUp is lean-FORWARD, so an arrow-key "ride" leaves
the craft at 0 km/h and the clock at zero), then press Escape.

Under the software rasterizer these labs run on, that costs about seven
seconds of wall clock per second of run — a race is still in its COUNTDOWN
after twenty seconds of riding. Drop the picture rows in the URL
(`water=low&detail=low&distance=low&see=0&resolution=low`) and budget minutes
per viewport, or the shot comes back with a clock reading `0'00"00` and looks
like a frozen game.
