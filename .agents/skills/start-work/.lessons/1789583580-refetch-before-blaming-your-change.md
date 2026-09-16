---
title: A test that is red and looks unrelated is main's, not yours — re-fetch `origin/main` before spending an hour proving it
date: 2026-09-16
concepts: [git, vitest, remote-session, measurement]
---

`make test` late in a session failed one case in a subject the change never
touched. Confirming it was pre-existing (restore the changed files from HEAD,
or a `git worktree add <dir> origin/main` with the repo's `node_modules`
symlinked in, then run that one file) took minutes and was right. Then an hour
went into trying to FIX it — sweeping ninety seeds for a staging that would
restore its premise — before a look at `origin/main` showed a commit landed
during the session had already fixed exactly that test, plus several more.

So, in this order, the moment an unrelated test is red:

1. `git fetch origin main && git log --oneline HEAD..origin/main` — on an
   active repo, main moves within the hour, and the fix is often already
   there. Rebase and re-run before anything else.
2. Only if main is still red there, confirm it pre-exists with the worktree
   above and decide whether it is yours to fix.

This repo's preflight already fetches at the start and again before delivery;
the gap it does not cover is the MIDDLE of a long session, where a red suite
is the trigger to re-fetch rather than to investigate. The worktree trick is
worth keeping for the confirmation step either way — it never moves the
working tree, which `git stash` does, and this skill's other lessons say why
that matters.
