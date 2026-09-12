---
title: A card's MOTION cannot be judged by waiting — headless makes frames only on demand, so `page.screenshot` is both the camera and the vsync, and the game behind the card must be refused
date: 2026-09-12
scope: pwa/src/game, pwa/src/styles.css, scripts/screenshot.mjs
concepts: [screenshots, surfaces, splash, animation, menu-nav]
---

A still is enough to judge a card. A SEQUENCE — a fade, a travel, a mark
drawing itself — needs frames, and headless Chromium makes a compositor frame
only when something asks for one. Two plausible ways of filming one both lie:

- `waitForTimeout` then `page.screenshot` at intervals: `waitForFunction` is
  rAF-polled, so frames flow while it waits and the whole sequence finishes
  before the first shot. Every frame comes back settled.
- CDP `Page.startScreencast`: returns one still repeated. Nothing damages, so
  nothing is drawn, so nothing damages.

The tell that you are looking at starvation and not at broken CSS:
`document.getAnimations()` reports `playState: "running"` with
`currentTime: 0` and **`startTime: null`** — animations created after the last
forced frame are `play-pending` for ever. `document.timeline.currentTime`
keeps advancing regardless, so it proves nothing.

What works: `page.screenshot` forces a frame, so a tight shot loop is the
camera AND the vsync. But a shot costs **~5 s** with the game building behind
the card under a software rasterizer — slower than the sequence — so refuse
the renderer's chunk (`page.route("**/assets/renderer-*.js", r => r.abort())`).
The card then never goes warm and hands over on `SPLASH_STUCK_MS` instead,
which is the same hand-over, over an idle main thread: ~20 shots a second,
enough to film 2.4 s.

The same refusal is the only way to photograph the attract card's BEAT ONE at
all: `SURFACES.splash` waits on `.splash-title`, which is beat two.
