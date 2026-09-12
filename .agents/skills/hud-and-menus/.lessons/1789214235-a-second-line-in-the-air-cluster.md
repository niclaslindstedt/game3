---
title: A readout that shares the air clock's centreline joins `.hud-air` as a second line — and `.hud-air` was a flex ROW, so the first draft put it beside the clock
date: 2026-09-12
scope: pwa/src/game/hud.tsx, pwa/src/styles.css
concepts: [layout, hud, css, screenshots]
---

The trick combo is the same moment as the air clock — the seconds the hull
has been up and what they are worth — so it belongs under it on the same
centreline rather than in a corner of its own. The way to do that is to
render it INSIDE `.hud-air` and widen that container's condition
(`airTime > 0 || combo > 0`), because the combo outlives the clock by the
length of the link window.

`.hud-air` was `display: flex; align-items: flex-start` with a single child,
which is a ROW: the second child landed beside the clock and shoved the
clock off the centreline the whole element exists to hold. It needs
`flex-direction: column; align-items: center`. The screenshot is what caught
it — nothing about the markup looked wrong.

The container's `transform: translateX(-50%) scale(...)` keeps working
either way, so the growth with `--air-grow` carries the new line with it for
free, which is what you want: one reading that gets bigger together.

THE BEAT ON A MULTIPLIER NEEDS NO EVENT PLUMBING. The HUD samples at ~12 Hz
and would miss a one-step event; instead put the multiplier's value on the
element's `key` and let a CSS animation replay when Preact remounts it. The
same trick banks the score chip: `key={snap.score}` and a 340 ms
overshoot — the number ARRIVES at its new value rather than creeping to it.
