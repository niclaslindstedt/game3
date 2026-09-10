---
title: When main landed the SAME subject in parallel, resolve a heavily conflicted file by taking main's whole file and re-applying your additions as scripted edits, not by editing the hunks
date: 2026-09-10
concepts: [rebase, resolution, parallel-work, scripted-edits]
---

A rebase onto a main that grew the same feature (a DISTANCE row landed
while a PR adding a FRAME RATE row and a flora cull was open) conflicts in
every file both sides touched, and the hunks interleave two designs. Editing
the markers is the slow, error-prone path. What worked: `git show
origin/main:<path> > <path>` for each conflicted source file, then re-apply
this branch's additions as a Python/sed script with an `assert old in s` on
every anchor, taken from `git show <my-commit>:<path>` for the exact text.
Main's design wins where the two overlap (its ladder, its naming, its
module), and this branch's part is stated once on top of it — which also
makes the "prove nothing was lost" diff against origin/main read as only
your change. Keep the files where this branch is strictly better (the
flora's one-buffer-per-species cull) as this branch's version, adapted to
main's API, and say so in the commit. A Node bench or a pixel diff against
a build of origin/main in a scratch `git worktree` (symlink `node_modules`
into it) is what proves the merged tree beats main rather than only the
pre-merge base.
