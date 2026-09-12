---
title: An exception thrown inside the frame loop does not stop the loop — it repeats forever behind a card that still looks alive
date: 2026-09-12
scope: pwa/src/App.tsx, pwa/src/game/run-loader.ts, pwa/src/game/loading-screen.tsx
concepts: [loading, shell, surfaces, run-loader, debugging]
---

`frame()` books the next frame on its FIRST line (`raf = requestAnimationFrame(frame)`), so a throw
later in it kills nothing: the same call is made again next frame, and the next. Combine that with
the loading card's whole design — every animation on it is a compositor transform, precisely so it
keeps moving while the main thread is blocked — and a step that throws reads as a load that is
still working, forever, with no way off it.

That is not hypothetical: `generateLevel` THROWS when it has rejected every one of its bounded
sub-seeds, which happens on roughly one seed in a hundred per coast. Before the catch in
`advanceLoad`, picking such a seed froze the game on `BUILDING THE SHORE… (1/3)`.

Two rules fall out, and both are now in the code:

- **A load step's throw is caught by `advanceLoad` and recorded on `LoadJob.failed`.** The card
  reads it and says so. Never let a step's exception reach the frame.
- **Anything built at BOOT needs a fallback, not just a catch.** `App.tsx` builds the attract sea
  before the first paint, so a refused seed there took the whole page down — and the seed is
  STORED, so the next visit died the same way with no menu to change it from. `fallbackGame`
  (`new-game.ts`) is why the page still mounts.

When checking this kind of freeze, drive the built site and watch `pageerror`: a page that is
"hung" but logging one error per frame is this shape, not a deadlock.
