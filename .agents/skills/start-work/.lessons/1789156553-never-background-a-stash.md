---
title: Never background a `git stash`-wrapped before/after run — it reverts the tree under whatever else you are doing
date: 2026-09-11
concepts: [tooling, measurement, remote-session, git]
---

Comparing a tuning change against its baseline is tempting to script as one
backgrounded job: `make sim` (after), `git stash`, `make sim` (before),
`git stash pop`. Do not. The stash reverts the WORKING TREE, so everything
else the session does during that window reads the baseline: a `make build`
started in it produced a baseline `pwa/dist/`, and the two screenshots taken
from that dist were photographs of the code the change was meant to replace.
Nothing failed and nothing warned — the pictures just quietly showed the
wrong tree, and `git stash list` was the only way to notice.

If a before/after needs both trees, either run it strictly in the FOREGROUND
with nothing else in flight (flip the one constant with `sed`, build, shoot,
flip it back — and verify the value on disk afterwards), or give the baseline
its own `git worktree` so the working tree never moves. When a job must be
backgrounded, have it leave the value it finished on in its own output and
check that before trusting any artifact from that window.
