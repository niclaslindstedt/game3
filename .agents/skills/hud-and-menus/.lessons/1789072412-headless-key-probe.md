---
title: A headless probe that presses keys must call page.bringToFront() first — without it the manager CLAIMS the key and the craft still never moves
date: 2026-09-10
scope: pwa/src/game/input.ts, scripts/
concepts: [input, keys, screenshots, verification, playwright]
---

There is no test over `input.ts` (it touches the DOM, and the root tsconfig
has no `dom` lib), so a key REBINDING is only provable by driving the built
site. Three traps, in the order they bite:

- **A scratch `.mjs` must live inside the repo tree.** Node resolves
  `playwright-core` from the SCRIPT's directory, not the cwd, so a probe in
  a scratch dir dies with `ERR_MODULE_NOT_FOUND` no matter where you run it.
  `previews/` is gitignored and works. `playwright-core` is deliberately not
  a dependency: `npm install --no-save playwright-core@1`.
- **`page.bringToFront()` before any `page.keyboard.*`.** Without it the
  keydown still reaches `window` and the input manager still claims it
  (`e.defaultPrevented` is true), but the craft does not move — so the
  binding looks dead when it is fine. This is the expensive one, because
  every signal says the key arrived.
- **The headless sim clock runs at roughly a third of wall time.** Hold a
  key for a number of SIM seconds read off `.hud-clock-time`, not wall
  seconds off `waitForTimeout`, or a throttle test reports no acceleration
  simply because 8 s of wall was 2 s of ride.

One more: to read `defaultPrevented` honestly, add the listener in the
BUBBLE phase (the manager listens on `window` bubbling). A capture-phase
listener runs before the manager and always reports `false`.
