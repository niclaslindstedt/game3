---
title: A pure-Node lab that rides the SYNTHETIC shore imports `tests/support/synthetic.ts` — after `aliasEngine(root)`, or its `@engine` import dies as an invalid package name
date: 2026-09-16
scope: scripts/wash-lab.mjs, scripts/lib/engine-alias.mjs, tests/support/synthetic.ts
concepts: [tooling, synthetic-level, alias, labs]
---

`tests/support/synthetic.ts` is the flat deep-water shore every physics
test stages on, and a lab that wants a controlled ride (the wash lab's five
columns) is better off there than on a generated seed. It imports the
engine as `@engine`, which Node resolves only once `aliasEngine(root)`
from `scripts/lib/engine-alias.mjs` has been called — before the dynamic
`import()` of the support module, and the engine's own import may then go
through the same alias or the file path. Without it the error is
`ERR_INVALID_MODULE_SPECIFIER: Invalid module "@engine"`, which reads as a
broken test file and is not one. The rides themselves are `createGame({
level, windSpeed })` plus `placeRun` and a held input; the run's own
`sea.washes` is then read back with `washAt`, never restated.
