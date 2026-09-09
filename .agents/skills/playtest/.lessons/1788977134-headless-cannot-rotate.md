---
title: Headless Chromium cannot reproduce a phone's rotation — `setViewportSize` relayouts BEFORE it dispatches `resize`, so probe a box that settles with no resize event at all
date: 2026-09-09
scope: scripts/screenshot.mjs, pwa/src/game/renderer.ts
concepts: [renderer, viewport, rotation, screenshots]
---

A rotation bug reported from a phone will not reproduce under
`page.setViewportSize()`. Playwright resizes the window, Chromium lays the
page out synchronously, and only then fires `resize` — so a listener on the
window measures the NEW box and a broken build passes the probe. A phone does
the opposite: iOS announces the rotation once, mid-animation, and the final
box arrives on its own afterwards.

Probe the mechanism instead of the platform: change the canvas's box with no
resize event to announce it (append a `<style>` that resizes `#root`), then
read `canvas.clientWidth/Height` against `canvas.width/height`. A build that
sizes the drawing buffer off a window listener leaves the old buffer stretched
onto the new box; one that observes the element matches it. That probe told
the two builds apart when the rotation probe could not.

Read the aspects, not just the pixels — `box 234x380 buffer 780x1688` is one
number pair; `aspect 0.616 vs 0.462` is the stretch the player is complaining
about.
