---
title: When a screenshot is not enough, probe the viewport with `getBoundingClientRect` — and set `hasTouch`, or the touch zones are not in the DOM to measure
date: 2026-09-11
scope: pwa/src/styles.css, scripts/screenshot.mjs
concepts: [viewports, screenshots, layout, touch, media-queries]
---

`previews/` is gitignored, so a throwaway probe can live there: `import {
serveDir } from "../scripts/lib/serve-dist.mjs"`, open a page at the size in
question, and both screenshot it AND read boxes back with
`getBoundingClientRect`. That is how you get a NUMBER — 129 px of overflow,
3 px of press travel — where a picture only gets you a suspicion.

Two things the probe has to get right:

- **`hasTouch: true` on `newPage`**, or the touch zones are not in the DOM at
  all and every clearance measurement silently comes back null. (`isMobile`
  also swaps in the mobile visual viewport, which moves the layout under the
  camera — a second change, usually not the one you want.)
- **A card that overflows does not clip**, it scrolls. `.menu-card` is
  `max-height: 100%; overflow-y: auto`, so the only honest reading is
  `scrollHeight - clientHeight`, not the screenshot.

When the question is "make ours as big as the sibling's", do not eyeball two
pictures. Read the sibling's CSS rule and EVALUATE IT at the viewport: a
`clamp(rem, vmin, rem)` plate is carried by its rem FLOOR on a phone in
landscape (vmin is the SHORT edge there), so comparing the vmin terms
compares the wrong halves of the two rules.
