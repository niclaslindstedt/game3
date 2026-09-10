---
title: A setting that applies live goes to the renderer as a WHOLE blob, and a pixel-ratio change needs the cached viewport cleared or `resize` short-circuits it
date: 2026-09-10
scope: pwa/src/game/renderer.ts, pwa/src/lib/viewport.ts, pwa/src/App.tsx
concepts: [options, settings, renderer, viewports]
---

OPTIONS is over a live bot-ridden sea, so a picture row is judged by watching
the water change while the card is still up. Two things make that work.

The renderer takes the whole settings blob (`renderer.setVideo(video)`) and
diffs it against what it last had, rather than the app calling a setter per
row. Only the renderer knows which rows are free (a uniform, an instance
count), which need a rebuild (the water grid's geometry), and which order they
have to be applied in — a rebuild has to re-`retone` for the current sky or
the new mesh flashes a noon sea under a squall.

`resize()` returns early on a box it has already measured (`sameViewport`), and
a RESOLUTION change does not change the box — only what a CSS pixel is worth.
So it needs `viewport = null` before the call, or the row does nothing and
looks like a dead setting. Same trap for anything else that changes the
drawing buffer without changing the layout.

Drive it rather than trusting it: a scratch playwright script that walks
attract → front door → OPTIONS, presses every stop of every row, and reads
`window.__SH_COST__.frameMs` after each press proves nothing threw, and the
WATER row's frameMs (6 / 9 / 14 ms on this container) is the row's cost, live.

**But frameMs is NOT a liveness probe** — that half of this lesson was wrong.
Under the software rasterizer these labs run on it quantizes hard: a frozen
frame and a running sea both report a single unchanging value (5 ms, measured),
so a live loop reads as a dead one and vice versa. To ask whether the picture
is MOVING, take two `page.screenshot({ clip })` of the same patch of sea half a
second apart and compare the bytes.
