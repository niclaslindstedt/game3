---
title: A card is paid for in HEIGHT and in WIDTH, both budgets hide their own regression, and the one silhouette that spends neither is the knob row
date: 2026-09-10
scope: pwa/src/game/menu-knobs.tsx, pwa/src/game/menu-start.tsx, pwa/src/game/menu-options.tsx, pwa/src/styles.css
concepts: [options, start-card, pause, layout, viewports, screenshots]
---

`.menu-card` is `max-height: 100%; overflow-y: auto`, so a height overrun
never breaks visibly — the card's bottom just slides past the viewport, which
reads as a bug and shows in no diff. A label overrun is the same story
sideways. So `make build && make screenshots ARGS="--surface start"` (or
`options`) BEFORE the edit as well as after, and read the card's bottom edge
and every row's left edge. `--surface` needs a value; bare `ARGS=--surface`
exits non-zero.

Why one shape for every setting: chips cost WIDTH per answer, so a five-stop
ladder wraps on any card narrow enough for a phone and the wrap reads as a bug
beside rows that did not; a switch carrying its own sentence costs two lines of
HEIGHT, and seven of them is a column that scrolls. The sibling's silhouette —
name, value between two arrows, pips under it — plus ONE caption bar reading
the hovered row spends neither: the pips say what the chips said (where on the
ladder, how many) inside the value's own fixed width.

Three things that port needed and are not obvious:

- `data-nav-steps` on the row is all the keyboard needs — `menu-nav.ts`
  collapses the pair to one stop and presses the arrows sideways, so a fader
  inside one is walked by its arrows and its `input[type=range]` never has to
  be reachable.
- Two `box-shadow`s at equal specificity are ONE box-shadow. The dealt pip is
  usually also the lit pip, so the mark must be an `outline`.
- "Back to the default shore" has no home on a typed field; mapping
  `DEFAULT_SEED` back to `seed: null` on commit keeps the semantics with no
  control at all.

A SQUARE element decides a card's whole layout, because its width IS its
height cost: the seed chart over one column was the tallest thing on the card
and still a thumbnail, and beside the rows (grid at `min-width: 48rem`, card
`46rem`) it costs nothing and draws half again as big. Reach for the
two-column card whenever a picture and a short ladder share a surface.
