---
title: A text slot reserved with `min-height` must sum the LEADING and the PADDING — the box is border-box, so the padding comes out of the reservation
date: 2026-09-16
scope: pwa/src/styles.css, pwa/src/game/menu-knobs.tsx
concepts: [knobs, options, start-card, layout, viewports, screenshots]
---

`.knob-caption` is the one sentence a card owns and it reserves its height so
the card stands still while the pointer crosses the rows. Two arithmetic traps
sit under that, and both produce a reservation that is SHORT by a line while
reading as correct:

- **The padding is inside the reservation.** The box is `border-box`, so
  `min-height: 2.7em` (two lines at `line-height: 1.35`) is two lines of TEXT
  and not two rows of CAPTION — the 0.7rem of padding comes out of it and what
  is left holds one line. Sum all three: `calc(2 * var(--caption-line) * 1em +
  2 * var(--caption-pad))`, with the leading and the padding stated once as
  custom properties the `line-height` and `padding` then read, so the floor
  follows when either moves.
- **An empty box is `min-height`; a filled one is the LINE-HEIGHT.** If the
  leading is left to inherit (~1.5), a `min-height` in `em` cannot agree with
  it. State both.

Get either wrong and the card jumps by exactly one line — the start card
623.8 → 635 px and OPTIONS 531.3 → 542.5 px at 1280×720, which on a centred
card moves every button away from the press already aimed at it.

NO SCREENSHOT CAN SEE THIS. The lab shoots the settled card, and a caption only
changes height while the pointer is moving. Measure it: a scratch playwright
script that dispatches `pointerenter` at each `.knob` (the rows raise their
hint on `onPointerEnter` — `.hover()` never returns on a card Preact
re-renders every frame) and reads `.menu-card`'s own height, which must not
move. Do it at 1280 AND 768; below `30rem` the reservation is deliberately
given back, because the longest sentences wrap to three and four rows there.
