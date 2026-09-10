---
title: A rule in the frame loop that reads the clock cannot be exercised on this container's frames — drive it with a FAKED clock from an init script
date: 2026-09-10
scope: pwa/src/App.tsx, pwa/src/game/video-probe.ts, pwa/src/game/frame-rate.ts
concepts: [probe, timing, frame-rate, screenshots, playwright]
---

Headless Chromium here draws the built site on a software rasterizer at
about 1.4 s a frame at 1280×720 and 0.6 s at 320×180 (measured off
`requestAnimationFrame` deltas). Every frame is over `FPS_STALL_MS`, so
anything gated on a frame being ordinary — the fps smoothing, the
first-visit probe — never sees one, and a "probed=false after two minutes"
reads as a bug in the code when it is the machine.

To drive such a rule, stub the clock before the page's own scripts with
`page.addInitScript`: `performance.now` returning wall time scaled down a
thousandfold, and `requestAnimationFrame` as a `setTimeout(…, 0)` that hands
the callback a stamp advancing 1000/60 each call. The loop then sees a
steady sixty-hertz display and a draw that costs a millisecond, and the
promotion path can be watched land in `localStorage` (`sea-haven-settings`)
and in `window.__SH_COST__` after `setVideo` rebuilds the water.

A scale of a hundred is not enough — the rasterizer's second-long frame
still reads as ten milliseconds.
