---
title: Preact hands an unknown SVG prop to setAttribute VERBATIM, and SVG names are case-sensitive — write them dashed
date: 2026-09-09
scope: pwa/src/game/
concepts: [svg, preact, hud, minimap, attributes]
---

`<path strokeDasharray={…} pathLength={1} />` in a `.tsx` here compiles,
typechecks, lints, and does NOTHING. Preact looks the prop up as a property
on the element; `strokeDasharray` is not one on `SVGPathElement` (it is a
`style` name, not an element property), so it falls through to
`setAttribute("strokeDasharray", …)` — and SVG attribute names are
case-sensitive, so the DOM stores an attribute nothing reads. No warning, no
error, no visible failure at the point of the mistake.

What it looks like downstream is a picture that is subtly, plausibly wrong:
the minimap's progress ring came out FULL on the start line, because with the
dasharray dropped the whole path was stroked. It read as a bug in the gauge's
arithmetic and it was not.

Write every SVG presentation attribute in its dashed form —
`stroke-dasharray`, `stroke-width`, `stroke-linecap` — or, better, put it in
`styles.css` where the rest of the HUD's paint lives and keep only geometry
in the JSX. The repo's existing SVG (`hud-dial.tsx`, `hud-touch.tsx`) already
does the latter; the minimap keeps `stroke-width` in the JSX only because the
ring's path geometry is computed from the same constant.

And do not reach for `pathLength` to normalise a dash to 0..1: it is dropped
the same way. Compute the path's own length as a constant beside the path
that produces it, and multiply.

The general shape of it: a wrong picture from an SVG attribute is worth ONE
`getComputedStyle` / `[...el.attributes]` probe in headless Chromium before
touching the arithmetic. That probe is thirty seconds and it names the layer
the fault is in.
