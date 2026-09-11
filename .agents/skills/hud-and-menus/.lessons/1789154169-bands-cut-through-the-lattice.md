---
title: A fill built out of whole lattice cells is a staircase — cut the band's edge THROUGH the cell instead, and the lattice can then be sized in cells-across rather than metres
date: 2026-09-11
scope: pwa/src/game/minimap-scene.ts
concepts: [minimap, svg, contours, performance, lattice]
---

The map's ground was emitted as axis-aligned rectangles per classified cell,
which at six metres over a 190 m window is a visible staircase — and one that
visibly DISAGREED with the smooth `level.shore` polyline stroked over it, so
the coast had two edges a metre or two apart.

The fix is marching squares' fill case, per cell, with no stitching: walk the
cell's four corners, keep the ones above the level, and interpolate the point
on every side the level crosses. Neighbouring cells compute a shared side's
crossing from the same two heights, so they agree to the last bit and the
edge comes out continuous — you never have to join the polygons up. Sample at
lattice NODES rather than cell centres (four cells share each node, so the
cache hits harder) and cache the HEIGHT, not a classification: every band is
then cut from the same numbers for free, which is what makes a four-rung
ladder cost the same walk as a two-tone plan.

Two things that fall out of it:

- **Size the lattice in CELLS ACROSS THE BOX, not metres.** A fixed metre
  cell costs four times as much every time the window doubles; here the
  window more than triples with the speedo, and the open end was ~10 000
  cells / 60 KiB of path / 6 ms, rebuilt about once a second on the
  renderer's thread. At a fixed count it is flat across the zoom, and detail
  is unchanged because what the eye resolves is a share of the box. Round the
  cell onto a coarse metre ladder — the lattice index is a cache key, and one
  that moved with the span would throw every sampled node away per re-cut.
- **Thousands of abutting polygons antialias into visible seams.** Stroke
  each band path in its own fill colour at a hairline width; use a group
  `opacity` (not a fill alpha) so the overlapping strokes do not darken where
  they meet.
