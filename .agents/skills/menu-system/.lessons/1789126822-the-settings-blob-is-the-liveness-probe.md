---
title: To prove an OPTIONS row does something, press it with playwright and read localStorage "sea-haven-settings" — the arrows are .knob-arrow nth(0)=UP, nth(1)=DOWN
date: 2026-09-11
scope: pwa/src/game/menu-options.tsx, pwa/src/game/menu-knobs.tsx
concepts: [options, settings, verification, screenshots]
---

The lesson beside this one says `window.__SH_COST__.frameMs` is not a liveness
probe (it quantizes hard under the software rasterizer). What IS one: press the
chips and read the stored settings back.

```js
const row = page.locator(".knob", { hasText: "WATER" }).first();
await row.locator(".knob-arrow").nth(0).click();   // 0 is UP, 1 is DOWN
const video = await page.evaluate(
  () => JSON.parse(localStorage.getItem("sea-haven-settings") ?? "{}").video);
```

Three things that cost a round each. The row class is `.knob`, not `.knob-row`.
The arrow order is nth(0) = up the ladder, nth(1) = down — pressing what reads
as "the right-hand arrow" by index walks the wrong way, and the symptom is a
probe that reports the opposite stop and looks like a settings bug. And the
probe has to live INSIDE the repo (`previews/` is gitignored and resolves
`playwright-core`); run from the scratchpad it dies on ERR_MODULE_NOT_FOUND.

`?menu=options&probe=0` opens the card directly, so there is no attract card or
front door to walk. This is how a cross-row guarantee — "DETAIL at HIGH cannot
raise a sea set to LOW" — is proved in the built app rather than only in the
unit tests.
