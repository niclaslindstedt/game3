---
title: The HUD was in NO screenshot because the first frame's dt is negative — check `.hud` is in the DOM before believing a shot of the readouts
date: 2026-09-10
scope: pwa/src/App.tsx, scripts/screenshot.mjs
concepts: [screenshots, hud, frame-loop, verification]
---

`make screenshots` photographed a bare canvas for months and it read as "the
HUD is off in shot mode". It was not: `App.tsx`'s frame loop took
`dtFrame = Math.min(0.1, (now - last) / 1000)` with **no floor**, and the first
`requestAnimationFrame` after `stand()` carries the timestamp of the frame that
was already under way when the level build began — more than a second BEHIND
the `performance.now()` taken after it. So the first `dtFrame` of every run was
about −1.4 s, `hudClock` went that far negative, and the HUD's 12 Hz tick did
not fire until the debt was paid back. `__SH_READY__` flips long before that,
so every shot missed the readouts, and a real player got no HUD for the first
seconds of a run. `clamp(..., 0, 0.1)` is the fix.

Two things to carry:

- **A wall-clock delta in a frame loop needs a floor as well as a ceiling.** The
  ceiling is the long-frame guard everybody writes; the floor is the one that
  bites, and it bites exactly once, at boot, after the most expensive thing the
  app does.
- **Before judging a HUD change from a screenshot, prove the HUD is IN it.** A
  three-line playwright probe (`waitForFunction("window.__SH_READY__")`, then
  `!!document.querySelector('.hud')`) answers in thirty seconds what an image
  cannot: an absent HUD and a HUD that is off look identical. The lessons here
  already say to wait on `.hud` rather than the ready flag — the reason is
  this, and it was a bug rather than a race.
