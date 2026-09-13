---
title: A readout drawn IN the world is a quad banked to the water's normal — a three LineBasicMaterial is one pixel wide whatever width you ask for
date: 2026-09-13
scope: pwa/src/game/guide-line.ts
concepts: [three, hud, water, shader, overlays]
---

Two things sank the first cut of the guide line, and both are general to
anything drawn in the sea rather than on the glass.

**`LineBasicMaterial`'s `linewidth` is ignored by every WebGL renderer.** A
"subtle" one-pixel line under a semi-transparent surface is not subtle, it is
invisible — and it stays invisible while you tune the colour, because the
colour was never the problem. Build the mark out of QUADS with their width in
metres instead; it also foreshortens with distance, which is most of the
reading.

**A flat horizontal quad on a wave face reads as paint.** `surfaceAt` returns a
normal as well as a height: widen the quad across `normal × along` (so it lies
in the water's tangent plane), and push it under the surface along `−normal`
rather than straight down. Then it banks with the face, rides over a crest, and
never pokes through one — which is what "looks like a real object in the water"
actually means. A plate pushed straight down on a steep face has its upper edge
come through.

Sorting: an opaque-looking mark still wants `transparent`, `depthWrite: false`
and `renderOrder` BELOW the water's, so three draws it before the near water
and the surface blends over the top of it. Its visibility then rides
`WaterMesh.seeThrough()` like the sea life's — which is honest, and worth
stating in the module, because a closed WATER row silently closes the readout.
