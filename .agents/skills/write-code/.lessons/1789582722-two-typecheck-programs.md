---
title: `npx tsc --noEmit` at the root does NOT check most of pwa/ — a module reachable only from a .tsx is outside that program, and needs `-p pwa`
date: 2026-09-16
scope: pwa/src, tsconfig.json
concepts: [typecheck, imports, tests, dom]
---

The root `tsconfig.json` sets no `jsx`, so no `.tsx` is in its program — and
neither is any `.ts` module reachable ONLY through one. `pwa/src/game/new-game.ts`
is the example: nothing in `tests/` can import it (it pulls `url-params.ts`,
which `import type`s `menu-main.tsx`), so a change that broke every one of its
call sites typechecked clean at the root and the error only appeared under
`npx tsc --noEmit -p pwa`.

This bites hardest when a shared type changes — renaming a field on
`RideSettings` reported two errors at the root and eleven more in `-p pwa`. So:
**both programs, always** (`npm run typecheck:only` is exactly `tsc --noEmit &&
npm run typecheck --workspace pwa`, which is what `make lint` runs). A root-only
pass is not a typecheck of this repo, it is a typecheck of the engine, the
tests and the handful of DOM-free app modules the suite happens to read.

The flip side is worth knowing when placing a module: if you want the root
suite to be able to read an app module, every import in its graph must stay
`.tsx`-free — which is why the payload modules (`shot-plan.ts`,
`picture-rows.ts`, `records.ts`, `rumble.ts`) are split out the way they are.
A type imported from a `.tsx` is enough to put a file out of reach.
