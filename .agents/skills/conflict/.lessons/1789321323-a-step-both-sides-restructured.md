---
title: When main added a line to a block your branch MOVED to another file, the resolution is your block here and main's line in its new home — and a `git merge-tree` count of zero proves nothing
date: 2026-09-13
scope: engine/game/step.ts, engine/game/run.ts
concepts: [rebase, resolution, parallel-work, moved-code]
---

Main landed one line inside `step()` (the altimeter's peak, taken after
`stepCraft`) while this branch lifted that whole block out of `step.ts` into
`run.ts`'s `stepRun`. Git shows it as one conflict hunk in `step.ts` with
main's whole old block on one side and the branch's three calls on the
other, and taking either side loses something: the branch's side drops the
peak, main's side drops the field. The honest resolution is the branch's
side in `step.ts` and main's new line re-applied inside `stepRun` — which
also hands it to every rival, which is what moving the block was for. Check
the other file after resolving: nothing in the conflict names it.

Also: GitHub read the PR as `dirty` while the old three-argument
`git merge-tree <base> <main> <head> | grep -c '^<<<<<<<'` printed 0 — that
form prints its own headers, not conflict markers, so a zero there is not a
clean merge. Trust `git rebase` (or `git merge-tree --write-tree` on a git
that has it), never that count.
