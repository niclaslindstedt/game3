---
title: An element's bounding box is not where its glyphs land — when a measurement and a screenshot disagree about an overlap, the screenshot is right
date: 2026-09-16
scope: pwa/src/game
concepts: [layout, screenshots, overlays, viewports]
---

Checking a head collision with `getBoundingClientRect` on the title and on the
action reported ELEVEN PIXELS OF CLEARANCE on a phone whose screenshot plainly
showed the last letter of the title under the button's border. The number was
not wrong about the boxes; it was answering a different question. A
`.menu-title` carries `letter-spacing`, which puts trailing space inside the
box after the final glyph, and a grid item is free to OVERFLOW its column
rather than shrink when its content cannot wrap — so the box can sit inside
the column while the ink does not.

So: take the screenshot first and read it, and use the boxes only to turn
what the picture already showed into a number worth comparing across rounds.
A measurement that contradicts a picture is a bug in the measurement until
proven otherwise, and acting on it costs a whole round-trip — which on a
surface that takes ten minutes to render is the expensive kind.

The reliable probes are the ones about LAYOUT rather than about ink:
`scrollHeight - clientHeight` for whether a card scrolls, one element's bottom
against its container's for whether a press clears the fold, and a
`getComputedStyle(el).lineHeight` division for how many lines a label wrapped
to. None of those depends on where a glyph stops.
