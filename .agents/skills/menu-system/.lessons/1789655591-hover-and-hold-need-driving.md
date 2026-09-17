---
title: A hover-only or hold-only state is INVISIBLE to `--surface`, and a fixed overlay's collision with a scrolling card is invisible in a settled shot too
date: 2026-09-17
scope: pwa/src/styles.css, pwa/src/game/menu-knobs.tsx, pwa/src/game/menu-main.tsx, scripts/screenshot.mjs
concepts: [screenshots, caption, hold, layout, viewports, verification]
---

`make screenshots ARGS="--surface x"` photographs the card SETTLED, with no
pointer on it and no finger down. So two whole classes of change come back
from the lab looking untouched:

- **What only exists while something is held or hovered** — the caption bar's
  lit state, RACE's seven-second hold. Removing the hold's fill and its "KEEP
  HOLDING…" label changes nothing in any `--surface menu` picture; the way to
  see it is to DRIVE the page. A scratch playwright file at the repo ROOT
  (`playwright-core` resolves from `node_modules`, not from a scratchpad),
  `serveDir` from `scripts/lib/serve-dist.mjs`, `?menu=root`, then
  `mouse.down()` and read the label and the class list at 3 s and at 8 s.
  Assert the whole rule while you are in there, not just the pixels: that the
  release does NOT start a run, and that the very next press DOES.
- **What a card does when it is SCROLLED.** The lab shoots the top of the
  card, so an element fixed to the foot of the window sitting over the card's
  last row only appears once somebody scrolls to the bottom. Drive it:
  `el.scrollTop = el.scrollHeight`, then compare the last `.knob`'s
  `boundingBox()` bottom against the bar's top. The PAUSE card in LANDSCAPE
  (390 tall) is the case — it is the one card that genuinely scrolls, and
  every portrait card now fits without scrolling at all.

**`position: fixed` inside `.menu-card` is safe, and it is safe by luck that
can be taken away.** The card is the scroller, so a caption in its flow is a
caption below the fold on exactly the pages long enough to need one; fixed
fixes that, because a fixed box is laid out against the viewport and clipped
by nothing — UNLESS an ancestor carries a transform, a filter, `perspective`,
`contain` or `will-change`. Nothing between the bar and the root does today
(every transform on these pages is on a button). Put one on `.menu` or
`.menu-card` and the bar silently goes back to being clipped by the card.

Reserve the overlay's strip on `.menu`'s `padding-bottom` under
`:has(.knob-caption)`, never as padding inside the card: the card is the
scroller, so padding there is dead space at the foot of every card SHORT
enough not to scroll — which is most of them. Taken off the box the card is
CENTRED in, a short card just sits a few pixels higher and nothing reads as a
gap, while a full-height one can no longer reach under the bar.
