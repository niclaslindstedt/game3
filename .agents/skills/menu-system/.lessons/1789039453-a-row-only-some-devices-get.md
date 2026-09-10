---
title: A row only SOME devices get is still stored on all of them — and the screenshot lab cannot photograph it
date: 2026-09-10
scope: pwa/src/game/menu-options.tsx, pwa/src/game/settings.ts, pwa/src/game/haptics.ts, scripts/screenshot.mjs
concepts: [options, settings, haptics, screenshots, devices]
---

OPTIONS ▸ RIDING ▸ VIBRATION is the page's first row that is not offered everywhere: `canRumble()` asks whether the machine has a motor worth switching. Two things follow that are easy to get wrong in opposite directions.

**The SETTING is unconditional; only the ROW is conditional.** `Settings.rumble` merges on every machine, because a phone and the laptop beside it read one blob — a build that dropped the field where it drew no row would switch the phone's vibration off the next time the laptop saved. Whether to DRAW the row is a question about the device, asked once per opening (`useState(canRumble)`, not per render — the probe reaches for `navigator` and the touchscreen).

**`make screenshots --surface options` cannot show it.** Headless Chromium reports `maxTouchPoints === 0` and has no `navigator.vibrate`, so the row is correctly absent from both the desktop and the phone shot — the phone VIEWPORT is a size, not a device. To photograph it, drive the built site with playwright-core directly and `page.addInitScript` a `maxTouchPoints` getter and a `navigator.vibrate` stub before the page boots; `hasTouch: true` on the context alone is not enough. Worth doing: the row changed the RIDING group from one row to two and the two columns' balance with it (four left, five right), which no unit test sees.
