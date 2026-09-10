---
title: A fixed `inset: 0` shell stops at iOS's LAYOUT viewport and leaves a blue dead band under the instruments — only an explicit `--shell-height` reaches the physical bottom
date: 2026-09-10
scope: pwa/src/styles.css
concepts: [ios, pwa, layout, safe-area, viewport, screenshots]
---

`#root { position: fixed; inset: 0 }` and `html, body { height: 100% }` both
stop at iOS's letterboxed layout viewport, so the game paints down to that edge
and `body`'s `--sea` fills the rest: a flat blue strip under the rev bar, the
speed and the build stamp on an installed iPhone. `viewport-fit=cover` and the
`env(safe-area-inset-*)` anchors do NOT fix it — they place instruments inside
the box, they do not grow the box.

The fix is the sibling repo's, ported verbatim in vocabulary: an iOS-scoped
`@supports (-webkit-touch-callout: none)` block setting `--shell-height: 100vh`
(`100dvh` under `@media (display-mode: browser)`, because in Safari proper the
toolbar is on screen and `100vh` hangs the bottom instruments off the bottom
edge) and applying it to `html, body, #root`. On the fixed `#root` the explicit
height over-constrains the box, so `bottom` is dropped and `top` + `height`
win; the canvas, `.hud` and the renderer's `ResizeObserver` all follow.
Match on `browser`, not `standalone` — an installed app's display mode is not
reliably `standalone`.

**You cannot photograph this bug here.** Only Chromium is installed, and
`CSS.supports("-webkit-touch-callout", "none")` is FALSE in it, so the block
never opens and a screenshot proves only that nothing off iOS moved. The two
honest checks are: assert that gate is shut (no Android/desktop regression),
then `page.addStyleTag` the rule body and re-measure `#root` / `canvas` /
`.hud` to prove the declaration reaches them.

A scratch Playwright probe must live in the REPO ROOT and import
`playwright-core` — `playwright` is not a dependency, and a script under the
scratchpad cannot resolve either. `serveDir` from
`scripts/lib/serve-dist.mjs` serves `pwa/dist` the way the lab does.
