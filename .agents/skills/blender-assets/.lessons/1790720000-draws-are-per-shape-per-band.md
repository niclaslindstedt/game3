---
title: A modelled tree kind is a draw call a shape a band a pass — count them before the triangles
date: 2026-09-29
scope: pwa/src/game/flora.ts, scripts/blender/tree.py
concepts: [trees, budget, draw-calls, profile]
---

The first cut of the modelled woods drew all six variants whole to 150 m and
a sketch of each beyond: the taiga went from 120 draws and 963k triangles to
250 and 1.34M, because every variant in every band is its own instanced mesh
and the water's mirror draws the near ones again. Four whole shapes, two
sketches, a 90 m band and sketches no dearer than the code's own tree brought
it to +58 draws and +11 % triangles — and the mangrove below where it
started, the code's palms having cost more than the models' sketches. Price
the far band against the CODE's tree, not against the model's whole one: the
far band is most of the plants on screen.
