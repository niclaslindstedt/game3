---
title: A row added to the start card must be paid for in HEIGHT — the card scrolls, so it hides its own regression, and RIDE goes below the fold
date: 2026-09-10
scope: pwa/src/game/menu-start.tsx, pwa/src/styles.css
concepts: [start-card, layout, screenshots, viewports]
---

`.menu-card` is `max-height: 100%; overflow-y: auto`, so adding a row never
breaks anything visibly — it just pushes the bottom of the card past the
viewport, and on the start card the bottom of the card is RIDE. At the two
reference viewports the card had about 95 CSS px of slack (1280×720) and
about 129 (390×844); ONE `OptionRow` whose chips wrap to two lines costs
roughly 105, so it clipped RIDE at both.

So: `make build && make screenshots ARGS="--surface start"` BEFORE the edit as
well as after, and read the bottom edge of the shot rather than the diff. Note
that `--surface` needs a value (`--surface start`); bare `ARGS=--surface`
exits non-zero.

The height donor is the seed chart, not the rows: `.seed-preview-map` was a
flat `max-width: 14rem`, and a square element's width IS its height cost.
`max-width: min(14rem, 22vh)` gives the pixels back exactly on the short
windows that need them and keeps the full-size chart everywhere else. 21vh is
comfortable, 24vh leaves only ~20 px of card margin at 720 — check the shot
rather than trusting the arithmetic.

A six-chip row (AS DEALT plus a five-value engine ladder) cannot fit one line
at the card's 30rem width no matter how the labels are shortened; the wrap is
the design, and it is already what every row does at phone width.
