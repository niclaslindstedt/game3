---
title: The two reference viewports miss phone LANDSCAPE, which is how the game is actually held — check it by hand whenever HUD furniture is resized
date: 2026-09-11
scope: pwa/src/styles.css, scripts/screenshot.mjs
concepts: [viewports, screenshots, layout, touch, media-queries]
---

`scripts/screenshot.mjs` shoots 1280×720 and 390×844. Neither trips a
`@media (orientation: landscape) and (max-height: 30rem)` rule — 720 and 844
are both over 480 px — so everything that query changes is INVISIBLE to the
whole sweep, on the one viewport a phone is actually held at to play. A bug
report arriving as a phone-landscape screenshot is therefore a report about
CSS no picture in `previews/` has ever shown.

Check it with a throwaway probe rather than by eye: `previews/` is
gitignored, so a script dropped there can `import { serveDir } from
"../scripts/lib/serve-dist.mjs"`, open a page at 852×393 with
`deviceScaleFactor: 3`, and both screenshot it and read the boxes back with
`getBoundingClientRect`. Note `hasTouch: true, isMobile: true` on
`newPage` — without it the touch zones are not in the DOM at all and every
clearance measurement silently comes back null.

When the question is "make ours as big as the sibling's", do not eyeball the
two pictures. Read the sibling's CSS rule and evaluate it at the viewport in
question: a `clamp(rem, vmin, rem)` plate is carried by its rem FLOOR on a
phone in landscape (vmin is the SHORT edge there), not by the vmin term, so
comparing the vmin terms compares the wrong halves of the two rules. A
reference screenshot confirms the arithmetic for free — its PNG IHDR gives
the pixel size, and pixels ÷ device ratio is CSS px.
