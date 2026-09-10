---
title: Judge anything at the transom on a 3× device-scale capture clipped to the stern — a 1280 px frame hides both a dark gap behind the hull and a road with no texture in it
date: 2026-09-10
scope: pwa/src/game/wake.ts, pwa/src/game/spray.ts, scripts/screenshot.mjs
concepts: [screenshots, zoom, wake, spray, verification]
---

Two faults survived five rounds of `make screenshots` and showed on the
first zoomed capture: the road began a metre behind the transom (the
newest trail sample lies up to a sample's spacing back — fixed with a
HEAD row laid at the transom every frame), and the fresh road was a flat
white blanket with no foam texture at all. Neither reads at 1280 px. A
scratch script that drives the built site through `serveDir`
(`scripts/lib/serve-dist.mjs`) and `playwright-core` exactly as
`screenshot.mjs` does, with `deviceScaleFactor: 3` and a `clip` on the
stern, is ten lines and worth writing again; the `close` camera at
`--t 5` of `cruise` and the `far` camera on `carve` are the two clips
that showed everything.
