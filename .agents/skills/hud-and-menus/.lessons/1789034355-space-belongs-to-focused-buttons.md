---
title: Binding a run key that the browser uses to press a focused control (SPACE) needs the input manager to stop claiming keys outside a run
date: 2026-09-10
scope: pwa/src/game/input.ts, pwa/src/App.tsx
concepts: [input, keys, menus, accessibility]
---

`createInputManager`'s listeners live for the app's whole life, and its
keydown handler calls `preventDefault()` on every code in `KEY_CODES`
whatever surface is up. That was harmless while the bound keys were WASD,
the arrows and Shift: the menu's own nav handler sits UPSTREAM in the capture
phase and `stopPropagation`s the arrows and Escape before they arrive.

SPACE is different. `App.tsx` states it deliberately: every control on every
card is a real `<button>`, so Enter and Space on a focused one already
activate it, which is why the nav handler has no CONFIRM of its own. Space is
not in `NAV_KEYS`, so it falls straight through to the input manager — and a
`preventDefault()` there swallows the button press. Binding Space to the
brake would have broken pressing START with the keyboard.

The fix is a `claiming: () => boolean` predicate on `createInputManager`
(App passes `() => shellRef.current === "run"`), gating the held-key branch
only. Key-UP is deliberately left ungated, so a run left mid-throttle does
not come back to a throttle that is still down.

Before binding any new run key, check it against the two things the browser
already does with it on a focused control and on the page.
