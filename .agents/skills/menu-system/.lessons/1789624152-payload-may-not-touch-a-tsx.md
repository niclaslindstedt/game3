---
title: A DOM-free payload the root suite reads may not type-import a `.tsx` — the root tsconfig has no `jsx` and no DOM lib, so `tsc` fails where vitest passed
date: 2026-09-17
scope: pwa/src/game, tests, tsconfig.json
concepts: [settings, surfaces, menu-nav, testing, strings]
---

`vitest` strips types, so a test that imports an app module whose `import type`
chain reaches a component RUNS fine. `make lint`'s whole-program `tsc --noEmit`
does not: the root `tsconfig.json` includes only `engine`, `tests` and
`vitest.config.ts`, with `lib: ["ES2022"]` and no `jsx`, so the moment a test
reaches such a module it fails with `TS6142: … but '--jsx' is not set` — on the
MODULE, not on the test, which reads as a broken config and is not one.

Two chains bit in one pass: `url-params.ts` type-imported `MenuPage` from
`menu-main.tsx`, and `run-news.ts` type-imports `HudFlash`/`HudResult` from
`hud.tsx`. Either one drags the JSX transform and the DOM into a suite that
runs on plain Node.

The fix is the split the skill already asks for, applied to the TYPE as well as
the logic: the page union moved to its own `menu-page.ts` (the card re-exports
it, so `MenuPage` still has one spelling), and `recordKeyFor` moved out of
`run-news.ts` and beside `gameFor` in `new-game.ts`, where it belonged anyway.
Both modules then became root-reachable and testable.

So: before writing a test against an app module, check what its `import type`s
resolve to, not just what it imports at runtime — and when a payload module
needs a type that lives in a card, move the TYPE out rather than widening the
root tsconfig, which would pull DOM types into the engine's own program.
