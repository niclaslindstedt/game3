---
title: A file your branch CREATED by moving code out of another one never conflicts — so main's edit to the original is reverted silently, and git never asks
date: 2026-09-11
concepts: [rebase, resolution, parallel-work, refactor, verification]
---

The dangerous conflict is the one git does not raise. A branch that splits
a block out of a file (`defs/tuning.ts`'s sea + wind → a new `defs/sea.ts`)
and a main that retunes a number INSIDE that block produce exactly one
conflict — in the file both sides still touch. The NEW file is an add on
one side only, so it merges clean, carrying the branch's snapshot of the
block and silently reverting main's change. Resolve the visible conflict,
see the markers gone, run the tests green, and the fix is gone with nothing
anywhere saying so.

The rule: **after resolving, regenerate every moved file from MAIN's
version of its source, not from the branch's.** Re-run the extraction
script against `git show origin/main:<original>` rather than keeping the
file the branch committed. Then prove it mechanically — pull the block out
of main's file, strip indentation, and assert it equals what the new file
carries, allowing only the wrapper lines the move deliberately changed
(`sea: {` → `export const SEA = {`). A Python comparison that prints
"EXACTLY — nothing lost" or a unified diff is thirty seconds and is the
only thing that distinguishes a clean move from a quiet revert.

The tell that this applies: `git log HEAD..origin/main --name-only` lists a
file your branch DELETED content from, and `git status` shows the file you
moved it to as `A` rather than `UU`.
