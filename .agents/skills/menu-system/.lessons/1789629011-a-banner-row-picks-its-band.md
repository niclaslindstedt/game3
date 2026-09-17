---
title: A banner row's `object-fit: cover` picks the axis it crops on, so the SHOT's aspect decides whether `object-position` or the pan is the rule that frames it
date: 2026-09-17
scope: pwa/src/styles.css, pwa/src/game/menu-shores.tsx, scripts/coast-preview.mjs
concepts: [surfaces, layout, viewports, screenshots, campaign]
---

A shore row is a picture with the row's words on it, and the picture is wider
than the row so it can pan (the overhang IS the travel — a picture cut to the
shape of the hole it sits in has nowhere to slide to). That leaves one free
choice, the SHOT's own aspect, and it decides which rule frames the row:

- a source WIDER than the picture box fills by height and crops its SIDES, so
  `object-position` does almost nothing and the shot's extra width is thrown
  away. This is the sibling rally game's arrangement (8:1 into a 6.6:1 box).
- a source NARROWER than the box fills by width and chooses a BAND of its own
  HEIGHT. Then `object-position`'s second number is the whole framing decision
  and the shot's height is the budget it spends.

The second is the one to reach for when every degree across is subject, which
on a coast it is. It also buys the way out of the one artefact a wide game
frame has: three.js's fov is VERTICAL, so a wider capture opens the HORIZONTAL
field on a fixed lens (52° vertical is 88° across at 2:1, 100° at 2.4, 111° at
3), and past about 100° the corners look beyond where even the top DISTANCE
stop draws — the drawn edge of the sea against the sky, a pale seam in the top
corners that reads as a rendering bug and is not one. Shot at 2.4:1 and banded
at `50% 52%`, the row crops the seam off and keeps the horizon, the shore and
the near water; shot at 3:1 the seam is in the band.

Two numbers that are pairs, not taste: the row's height (`clamp`ed so the row
holds about 3:1 at every viewport) and the picture box's 130%, because the box
aspect is their product and that is what the band is a fraction of. Change one
and check the other, and `@media (prefers-reduced-motion)` parks the pan at
HALF the travel so the still frame is the middle of the sweep.
