---
title: A frozen staged shot stops WebGL fades on their first frame while DOM animations keep moving
date: 2026-09-16
scope: scripts/screenshot.mjs, pwa/src/App.tsx, pwa/src/game/checkpoint-arrow.ts
concepts: [screenshots, webgl, animation, staging, verification]
---

The screenshot lab's `shot=1` contract freezes the render loop as soon as the staged frame is ready. A three.js HUD element whose opacity or pose eases with frame `dt` is therefore photographed near the start of that easing even if the capture waits afterward; CSS animations continue independently and can make the DOM and WebGL halves look mismatched. To judge the settled state, run the same scene without `shot=1`, wait for the HUD selector and an explicit settling beat, then capture the live frame at the viewport under review.
