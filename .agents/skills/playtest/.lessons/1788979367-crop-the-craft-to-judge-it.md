---
title: Judge the craft and the rider CROPPED — a scratch Playwright page that scales the PNG 3× is the zoom, because no image tool is installed
date: 2026-09-09
scope: scripts/screenshot.mjs
concepts: [screenshots, chase-view, tooling, rider]
---

At 1280×720 the craft is about 180 px tall and the rider on it 60, and a
pose (a hang into a turn, a landing folded into the knees) reads only as a
silhouette — the Read tool downsizes a full frame further. There is no PIL,
no sharp and no PNG decoder in the tree, but playwright-core and Chromium are
there for the screenshots already: a scratch script that `setContent`s an
`<img>` whose `src` is the PNG as a base64 data URL (a `file://` src stays
blank), offsets it by the crop and `transform: scale(3)`s it, then
`page.screenshot`s a viewport of the crop's size, is a zoom in twenty lines.
Crop the craft region (about x 520–760, y 340–560 in the desktop frame at
the chase rig's default) and judge THAT; the same trick crops a `make
crafts` cell. A pose that reads there and not in the full frame is a
contrast problem, not a geometry one.
