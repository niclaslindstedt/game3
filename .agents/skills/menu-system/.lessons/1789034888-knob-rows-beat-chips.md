---
title: Chips are priced in WIDTH and prose in HEIGHT — one knob row plus one caption bar spends neither, and a SQUARE thing on a card decides the card's whole layout
date: 2026-09-10
scope: pwa/src/game/menu-knobs.tsx, pwa/src/game/menu-start.tsx, pwa/src/game/menu-options.tsx, pwa/src/styles.css
concepts: [options, start-card, pause, layout, viewports]
---

The four row shapes (chips, fader, stepper, switch-with-prose) each broke a
budget the card could not pay. Chips cost WIDTH per answer, so a five-stop
ladder wraps on any card narrow enough for a phone and the wrap reads as a
bug beside rows that did not. A switch carrying its own sentence costs two
lines of HEIGHT, and seven of them is a column that scrolls. Replacing all
four with the sibling's one silhouette — name, value between two arrows, pips
under it — plus ONE caption bar reading the hovered row spends neither: the
pips say what the chips said (where on the ladder, and how many) inside the
value's own fixed width.

Three things the port needed that are not obvious:

- `data-nav-steps` on the row is all the keyboard needs — `menu-nav.ts`
  already collapses the pair to one stop and presses the arrows sideways, so
  a fader inside such a row is walked by its arrows and its `input[type=range]`
  never has to be reachable.
- Two `box-shadow`s at equal specificity are ONE box-shadow. The dealt pip is
  usually also the LIT pip, so the mark has to be an `outline`, or it silently
  takes the glow away exactly where both are wanted.
- The start card's "back to the default shore" press has no home on a typed
  field. Mapping `DEFAULT_SEED` back to `seed: null` on commit keeps the
  semantics with no control at all.

A SQUARE element decides a card's layout, because its width IS its height
cost. The seed chart over one column of rows was the tallest thing on the
card and still a thumbnail; beside them (a grid at `min-width: 48rem`, card
`46rem`) it costs the card nothing — the rows are shorter either way — and is
drawn half again as big. Reach for the two-column card whenever a picture and
a short ladder of rows are on the same surface.
