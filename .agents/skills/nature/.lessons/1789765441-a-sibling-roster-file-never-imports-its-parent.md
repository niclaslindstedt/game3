---
title: A coast's sibling roster file is handed the parent's constants, never imports them back — the cycle reads `TREE_LINE` as `undefined` and every band built on it fails a test three files away
date: 2026-09-18
scope: pwa/src/game/flora-defs.ts, pwa/src/game/flora-defs-karst.ts, pwa/src/game/bird-defs.ts, engine/game/defs/fauna.ts
concepts: [biome, roster, imports, flora, tests]
---

`flora-defs.ts` states `TREE_LINE` and spreads the sibling coast files
(`flora-defs-arctic.ts`, `flora-defs-karst.ts`) into `FLORA`. A sibling
that `import { TREE_LINE } from "./flora-defs.ts"` makes a cycle: the
sibling evaluates FIRST (it is the parent's dependency), the parent's
`const` is not initialised yet, and under vitest's transform every
`ground.max: TREE_LINE` comes out `undefined` — no error at import time,
and the first sign is `flora_test`'s "actual value must be number,
received undefined" on a row that reads perfectly.

The fix that keeps one copy of the number: export the sibling's rows as a
function of the constant — `karstFlora(TREE_LINE)` — and let the parent
call it in the spread. A `type` import from the parent is fine (erased);
a VALUE import from it is the trap. The same shape holds for any future
sibling of `bird-defs.ts` or `defs/fauna.ts` that wants a parent constant.
