---
title: An overlay drawn UNDER THE THUMB has to have its CSS `top` equal its viewBox's min-y — split across styles.css and the .tsx, nothing catches the mismatch
date: 2026-09-11
scope: pwa/src/game/hud-touch.tsx, pwa/src/styles.css
concepts: [touch, svg, layout, overlays, hud]
---

`.hud-bar` / `.hud-lever` are zero-size divs positioned at the touch point,
with the SVG absolutely placed inside them — so the viewBox coordinate that
lands on the thumb is decided by `top`/`left` in styles.css and by the viewBox's
min-x/min-y in the .tsx, and the two have to be the same number. The bar got it
right (`left: -100px` against `viewBox="0 0 100 100"` on a 200 px box, so 50,50
is the centre); the lever did not — `top: -22px` against a min-y of
`-LEVER_REVERSE_PX - 22`, drawing the whole control 60 px below the finger that
anchored it. It typechecks, lints, screenshots clean in every capture the shot
tool takes (the overlays only exist while a finger is down), and reads as "the
touch feel is a bit off" rather than as a bug.

Two things follow. Write the anchored axis INLINE from the same constant that
builds the viewBox (`style={{ top: `${LEVER_TOP_PX}px` }}`) and leave only the
non-anchored one in the stylesheet — one expression cannot drift from itself.
And verify by driving the built site with a scratch playwright script that
presses the zone and screenshots mid-drag: `page.mouse.down()` then
`move(..., { steps })`, one shot per point of the throw. `make screenshots`
photographs the idle frame and can never see this.
