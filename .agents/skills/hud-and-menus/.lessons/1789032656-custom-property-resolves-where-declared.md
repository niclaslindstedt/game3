---
title: A `--var: calc(var(--other))` is resolved on the element it is DECLARED on, so a size derived from `--hud-map` in `:root` ignores the media queries that re-declare it on `.hud`
date: 2026-09-10
scope: pwa/src/styles.css
concepts: [css, layout, portrait, custom-properties, sizing]
---

The two glyph presses under the minimap are sized at half the map, and the
obvious way to write that is a `--hud-mini: calc((var(--hud-map) -
var(--hud-mini-gap)) / 2)` beside `--hud-map` in the `:root` block. It is
wrong. Both portrait and short-landscape re-declare `--hud-map` **on `.hud`**,
and a custom property's value is computed against the element it is declared
on — so the buttons kept the desktop map's proportions everywhere. At 844×390
that made them 36 px where the map beside them was 58, and left 4 px between
their bottom edge and the throttle glass.

Write the derivation where it is USED (`width: calc((var(--hud-map) -
var(--hud-mini-gap)) / 2)` on `.hud-mini-icon`): the lookup then walks the
inheritance chain from the element and finds whatever `.hud` currently says.
Only the constant that never varies — the gap — stays a `:root` var.

The general shape: a var that DERIVES from another var must live at, or below,
every place the other one is overridden. If you cannot say which element that
is, inline the calc.
