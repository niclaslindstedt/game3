---
title: The root `tsc --noEmit` does not cover `pwa/` — and a root-suite test that imports a DOM-typed module breaks the root program
date: 2026-09-17
scope: tsconfig.json, pwa/tsconfig.json, tests/
concepts: [typecheck, tests, dom, imports, gates]
---

`npm run typecheck` is two programs: `tsc --noEmit` at the root, then the same
inside the `pwa` workspace. They do not overlap, and the root one has no DOM
lib. Two things follow, both of which this session hit:

A bare `npx tsc --noEmit` at the root is NOT the whole-program check the
router's edit-loop rule is asking for when app code changed — it passed clean
on a `pwa/src/App.tsx` that was handing a removed property to a factory. Run
`npm run typecheck` (what `make lint` runs) whenever the change is in `pwa/`.

And the root program grows to whatever the SUITE imports. A test that reaches
a module which itself does `import type { GameRenderer } from "./renderer.ts"`
pulls `renderer.ts` into the root program, where `window` and `ResizeObserver`
do not exist — six errors in a file the change never touched. `import type` is
erased at runtime, so vitest is perfectly happy; it is the typecheck that is
not. The fix is not to widen the root's lib: it is to put the pure thing the
test wants in the pure module (here `ghost.ts`, beside the type it builds),
and take the level as the two fields it needs rather than as the whole row.
