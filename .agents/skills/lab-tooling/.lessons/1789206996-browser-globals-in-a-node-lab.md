---
title: A browser lab cannot write `document` in a `page.evaluate` — eslint gives `scripts/**` Node globals only, so inject through `addStyleTag` with the asset inlined
date: 2026-09-12
scope: scripts/
concepts: [screenshots, playwright, tooling, lint]
---

`eslint.config.js` hands `scripts/**/*.mjs` `globals.node` and nothing else,
so a `page.evaluate(() => document.createElement(...))` — perfectly correct
code that runs in the browser — fails `make lint` with `'document' is not
defined  no-undef`. `audition.mjs` looks like a counter-example and is not:
its `document` calls are inside a template literal, so they are text.

Two ways out, and the second is better. An inline disable works; but for
anything that is really "put an element on the page before the shutter",
`page.addStyleTag({ content })` does it in CSS with no globals at all — a
`body::after` with `position: fixed`, a size and a `background: url(...)`.

Inline the image as a `data:` URI rather than pointing the CSS at a served
path: read the file out of `pwa/dist` in Node and base64 it. The style then
applies in one go with nothing left to load, so the capture cannot race the
fetch, and the lab is provably drawing the BUILT site's own asset. A short
`waitForTimeout` after it is still worth having — `page.screenshot` does not
wait on a stylesheet.
