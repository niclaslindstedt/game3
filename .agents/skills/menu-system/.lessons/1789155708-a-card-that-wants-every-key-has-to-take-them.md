---
title: A card that captures a KEY loses to App.tsx's nav listener — hand the cursor's keys over with holdNav, because a listener added later cannot get in front of one in the same capture phase
date: 2026-09-11
scope: pwa/src/game/menu-keys.tsx, pwa/src/game/menu-nav.ts, pwa/src/App.tsx
concepts: [menu-nav, keyboard, bindings, capture-phase]
---

The binding page arms a `keydown` listener on `window` in the CAPTURE phase so
the input manager cannot ride the craft with the key being bound. That is
necessary and not sufficient: `App.tsx` registers `onMenuKey` on the same
window in the same capture phase when the app mounts, which is long before any
card exists — and listeners on one target in one phase fire in REGISTRATION
order. So the cursor eats ArrowUp, ArrowDown and Escape on their way to the
card, and the two keys a rider most wants on the handlebar are the two they
cannot bind.

Nothing about the DOM tree fixes this: `document` capture is DOWNSTREAM of
`window` capture, and `data-nav-own` only suppresses the ring and forwards the
four directions — Escape and every other code still go through `onMenuKey`.

The fix is to answer the question where it is already asked. `onMenuKey` bails
on `!nav.active()`, so `menu-nav.ts` carries a module-level latch and
`holdNav(true)` / `holdNav(false)` bracket the capture (set in the effect,
cleared in its cleanup, so an unmounted card cannot leave the cursor deaf).

Proving it needs a browser and takes ten seconds: bind an ARROW, not a letter.

```js
await page.locator(".knob-bind", { hasText: "THROTTLE" }).first().click();
await page.keyboard.press("ArrowUp");     // a letter would pass either way
```

And `e.defaultPrevented` read from a listener added AFTER the app's is the
cheap way to ask what the game claimed — `{KeyB: true, KeyW: false}` is a
rebound throttle proved end to end, with no need to watch a speed climb (under
the software rasterizer the frame cost means a held throttle buys about 1 km/h
a second, so the HUD is no help at all here).
