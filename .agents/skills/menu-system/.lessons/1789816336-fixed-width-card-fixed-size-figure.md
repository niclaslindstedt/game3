---
title: A figure on a card of CAPPED width takes a fixed font size, never a viewport clamp — and the state the lab cannot reach is measured by injecting it into the live DOM
date: 2026-09-19
scope: pwa/src/styles.css, pwa/src/game/menu-pause.tsx
concepts: [pause, layout, viewports, screenshots, measurement]
---

`.menu-card-pause` is `min(24rem, 100%)`, so a four-cell strip inside it is
81–88 px per cell at EVERY reference viewport — the column barely moves. A
figure sized `clamp(…, 2.6vw, …)` moves anyway: on a phone held sideways
(844×390) the `vw` term reaches its maximum while the cells are still a
phone's, and the widest figure walks out of its column into its neighbour's.
`vmin` fixes the sideways case and then makes the figures needlessly small on
both phones. The honest answer is a flat size, measured.

Measuring it is the other half. The strip only grows its fourth cell once the
run has flown something, which no lab can ride to — so put the cells into the
LIVE DOM with `page.evaluate` (`strip.replaceChildren(...)`) and read
`getBoundingClientRect()` on each value against its cell. That is a ruler, not
a fixture: nothing about the app changes, and it turns "does the widest
figure fit" into a boolean at all three viewports in one run. It caught
`0.88rem` spilling 3 px on desktop and phone-portrait while fitting landscape
— which no screenshot would ever have shown, because the lab can only ever
draw three cells.

The vertical rhythm goes the other way: every measure on this card is
`clamp(…, Nvmin, …)` against the SHORT axis, because phone-landscape is the
viewport that decides it.
