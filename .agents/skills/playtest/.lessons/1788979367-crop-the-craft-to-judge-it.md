---
title: Judge the craft and rider CROPPED — the 3× detail captures expose proportions a full frame hides
date: 2026-09-09
scope: scripts/screenshot.mjs
concepts: [screenshots, chase-view, tooling, rider]
---

At 1280×720 the craft is about 180 px tall and the rider on it 60, and a
pose (a hang into a turn, a landing folded into the knees) reads only as a
silhouette — the image viewer downsizes a full frame further. Use `make
screenshots SCENE=<name> ARGS=--details` for native 3× overhead and
45-degree chase crops around the craft; scaling the completed 1280 px image
cannot recover pixels already lost. Judge the crop and the normal screenshot
together. A pose that reads close and not at playing distance is a contrast
problem, not a geometry one; the same principle applies to a `make crafts`
cell.
