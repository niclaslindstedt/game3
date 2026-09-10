---
title: `npx tsc --noEmit` at the root is only HALF the typecheck — pwa/ is a second project, and `make build` runs both
date: 2026-09-10
scope: pwa/src/
concepts: [typecheck, build, tooling, gates]
---

AGENTS.md says to check with `npx tsc --noEmit` and to keep it
whole-program. True as far as it goes, but the root `tsconfig.json` does not
cover `pwa/src/` — that tree has its own `pwa/tsconfig.json`, and
`npm run typecheck:only` is two invocations:

```sh
tsc --noEmit && npm run typecheck --workspace pwa
```

So a mistake that lives entirely in an app module — this session's was a
redeclared `const` in `renderer.ts`'s `render` — comes back CLEAN from a
root-only run and then fails `make build`. Mid-loop, after editing anything
under `pwa/src/`, the check that answers is:

```sh
cd pwa && npx tsc --noEmit
```

THE TRAP THAT COSTS THE TIME is not the missed error, it is what happens
next: `make build` stops at the failed typecheck, `pwa/dist/` keeps the
LAST good build, and a browser-driven lab run in the same command line
(`&&` will stop, but a `;` or a separate call will not) then photographs or
profiles the previous change. The numbers come back plausible and wrong.
Always read `make build`'s own last line before trusting a lab that follows
it.
