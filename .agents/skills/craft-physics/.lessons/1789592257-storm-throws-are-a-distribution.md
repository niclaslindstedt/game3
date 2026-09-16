---
title: The tornado's throws are a chaotic sample — one seed's best over six minutes moves ±10 m on ANY physics change, so compare two trees as a distribution over seeds, run in parallel from tree copies, before believing a regression or a fix
date: 2026-09-16
scope: tests/tornado_test.ts, engine/game/tornado.ts, engine/game/submerged.ts
concepts: [tornado, measurement, chaos, bench, worktree, storm]
---

`tests/tornado_test.ts`'s "throws him twenty metres and more" reads the
MAXIMUM apex of a six-minute ride on seed 5, per craft, and its own comment
says six minutes is where the estimate settles. Under a change to anything
the hull does in a 20 m sea it does not settle: toggling one term at a time
(a fade, a drag, a crouch) moved the skiff's best between 22 and 32 m and
the marlin's between 15 and 32 m with no ordering between the toggles —
the sample is the luckiest wave of a chaotic ride, and every change re-deals
it. A single run of the test, or of a bench built like it, cannot tell a
regression from noise, and cannot tell a fix from luck either.

What does: the same ride over FIVE seeds at four minutes each, summarised as
mean best, min, max and flights per run, on BOTH trees. That showed the
real thing in one look — the skiff's mean best 41.8 → 28.7 m and every
craft's flights per run halved — where the single-seed runs had shown
nothing consistent.

Run the trees in parallel rather than in turn. `git worktree add <dir>
HEAD` with `node_modules` symlinked in gives the baseline; for a one-term
bisect, `cp -r engine tests scripts` into a scratch directory, symlink
`node_modules`, `sed` the one line there, and point the bench at it with
`aliasEngine(ROOT)` and `import(ROOT + "/engine/index.ts")` — four copies
run at once on four cores and nothing touches the working tree. Never
`git stash` for it: the lesson in `start-work` says why.
