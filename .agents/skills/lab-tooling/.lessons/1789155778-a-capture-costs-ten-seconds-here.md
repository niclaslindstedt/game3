---
title: A screenshot capture takes ~10 s in this container and its HUD receipt fades after 2.6 s of CSS time — poll at 100 ms and shoot immediately
date: 2026-09-11
scope: pwa/src/game/screenshots.ts, previews/
concepts: [screenshots, playwright, timing, hud, probe]
---

Pressing the shutter in the built site under headless Chromium here takes
9–13 s from keypress to receipt (measured at 1280×720 and at 390×844). It is
not a hang and not a bug in the capture: the software rasterizer draws about
one frame every 1.4 s, and a capture costs several frames — the HUD
rasterized through a `<foreignObject>` image decode, the mark's SVG decode,
then the PNG encode of a two-megapixel canvas. A probe that waits a second or
two after the press and then reads the DOM finds nothing and reads as a dead
key binding. Wait on the receipt itself
(`waitForFunction("…textContent.includes('PICTURE')")`), with a timeout in the
tens of seconds.

And do not expect to PHOTOGRAPH that receipt afterwards. `.hud-flash` fades on
a CSS animation at 2.6 s of WALL time — unrelated to the engine's own clock,
which is what `FLASH_LIFE` prunes against — so with Playwright's default `raf`
polling (one poll per 1.4 s frame here) the flash is already fading by the
time the screenshot lands. Pass `{ polling: 100 }` and screenshot in the same
breath, or accept a picture with an empty news column.
