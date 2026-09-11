---
title: The screenshot lab's "phone" was a desktop browser 390 px wide — a surface gated on touch was photographed as evidence FOR the thing that is not true
date: 2026-09-11
scope: scripts/screenshot.mjs, pwa/src/game/hud.tsx, pwa/src/game/input.ts, pwa/src/game/splash-screen.tsx
concepts: [screenshots, viewports, touch, verification]
---

`VIEWPORTS.phone` set a width, a height and a device scale factor and
nothing else, so Chromium opened the page as what it is by default: a
machine with a MOUSE — `navigator.maxTouchPoints` 0, `(pointer: fine)`,
`(hover: hover)`. Every phone shot the lab had ever taken was a narrow
desktop window.

That is invisible until a surface ASKS the device what it is, and three of
ours do: `hasTouch()` in `hud.tsx` (the thumb zones), `(pointer: coarse)`
in `splash-screen.tsx` (TAP against PRESS), and `hasKeyboard()` in
`input.ts` (the door to OPTIONS ▸ KEYBOARD). The phone shot then draws a
card the phone never draws — which is worse than having no shot, because
it is evidence FOR the wrong answer, and it is what you reach for when
somebody asks whether the row shows on a phone.

One key fixes it, and it is `hasTouch`, not `isMobile`:

```js
phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true },
```

`hasTouch` is what flips `maxTouchPoints` AND the pointer media queries in
Chromium (measured: `pointer: coarse`, `any-pointer: fine` false, `hover`
false). `isMobile` additionally swaps in the mobile visual viewport, which
moves the layout under the camera — a second change, and not one to make
while judging a first.

To check a device-gated surface without shipping it, `browser.newContext`
takes the same options and playwright-core carries `devices["iPhone 13"]`,
`["Pixel 7"]`, `["iPad Pro 11"]` — a five-line script over `pwa/dist` says
which surfaces each one draws. Beware `waitForSelector` on a card under an
emulated device: it timed out on a locator it had itself resolved as
visible. A flat `waitForTimeout` and a `page.evaluate` count got the answer.
