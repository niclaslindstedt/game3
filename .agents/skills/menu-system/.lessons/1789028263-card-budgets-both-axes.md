---
title: A row added to a card is paid for in HEIGHT and its label in WIDTH — both budgets hide their own regression, so read the shot rather than the diff
date: 2026-09-10
scope: pwa/src/game/menu-start.tsx, pwa/src/game/menu-options.tsx, pwa/src/styles.css
concepts: [start-card, options, layout, screenshots, viewports]
---

`.menu-card` is `max-height: 100%; overflow-y: auto` and `.menu-row` is
`flex-wrap: wrap`, so neither budget ever breaks visibly — the card's bottom
slides past the viewport, or one row silently stacks its chips under its
label. Both read as a bug and neither shows in a diff.

HEIGHT. At the two reference viewports the start card had about 95 CSS px of
slack (1280×720) and about 129 (390×844); ONE `OptionRow` whose chips wrap to
two lines costs roughly 105, so it clipped RIDE at both. The donor is the seed
chart, not the rows: a square element's width IS its height cost, so
`.seed-preview-map` went from a flat `max-width: 14rem` to
`min(14rem, 22vh)` — 21vh is comfortable, 24vh leaves ~20 px of margin at 720.

WIDTH. At 390 px the options card is ~322 CSS px inside, and a label plus
three stops lands within a few pixels of it: RESOLUTION + LOW/MEDIUM/HIGH
wrapped while WATER and DETAIL beside it did not. The fix is the LETTERS, not
the tap target — under `@media (max-width: 30rem)`, `.menu-opt`
`padding-inline: 0.46rem; letter-spacing: 0.06em` and `.menu-row`
`column-gap: 0.5rem` buys ~18 px with the chips' height untouched. A six-chip
row (AS DEALT plus a five-value engine ladder) cannot fit one line at the
card's 30rem width however short the labels are; there the wrap IS the design.

So `make build && make screenshots ARGS="--surface start"` (or `options`)
BEFORE the edit as well as after, and read the card's bottom edge and every
row's left edge. `--surface` needs a value; bare `ARGS=--surface` exits
non-zero.
