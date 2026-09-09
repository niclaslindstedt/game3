---
title: A root test MAY import three.js — the DOM rule is about document/window/.tsx, not about every browser package
date: 2026-09-09
scope: tests/
concepts: [tests, imports, dom, three]
---

The test conventions say the whole import graph must be DOM-free, and it is
easy to read that as "a test can never reach a module that imports three".
Not so: `import * as THREE from "three"` in a root `tests/*_test.ts`
typechecks under the root `tsconfig.json` (no `dom` lib) and runs under
vitest. Verified directly with a throwaway probe test.

What actually breaks is a module that touches `document`, `window` or
`navigator` at type level, and any `.tsx` at all (the root config sets no
`jsx`, so `import type` from one fails with TS6142).

Worth knowing before designing around it: a `pwa/` module may be kept
three-free for good LAYERING reasons — the sky's colour model
(`pwa/src/game/sky.ts`, `pwa/src/lib/colour.ts`) is, so that deciding a
colour and drawing it stay two jobs — but "otherwise the tests could not read
it" is not one of those reasons, and writing that in a header comment puts a
false claim in the tree.
