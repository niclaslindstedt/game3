---
title: Never `git stash` while a suite is in flight either — a FOREGROUND stash corrupts a backgrounded `make test` exactly as quietly as the backgrounded stash this skill already warns about
date: 2026-09-16
concepts: [tooling, measurement, git, vitest, remote-session]
---

The lesson beside this one warns against BACKGROUNDING a `git stash`-wrapped
before/after run, because the tree reverts under whatever else the session is
doing. The same trap fires the other way round and is easier to walk into: a
stash run carefully in the FOREGROUND, to check whether a failing test
predates the change, reverts the tree under a `make test` that was started in
the background five minutes earlier and has another minute to go. That run
then reports on a mixture of two trees, silently, and the only clue is that it
finishes suspiciously clean.

`make test` here is about six minutes of wall clock, so the window is wide.
Before any stash, check for one: `pgrep -af "vitest run"`. If a suite is
running, either wait for it or kill it — a second full run costs six minutes
and a wrong green costs the PR.

What the stash was FOR is still worth doing and needs no stash at all when the
question is "does this failure predate me": run the one test on the current
tree first, read the assertion, and only then decide. `mapgen_population_test`'s
"builds fast" is a WALL-CLOCK budget (900 ms to build a level), so it goes red
on a container that is also running a browser lab or a build — no stash
required to know that, and the honest fix is to re-run it on a quiet machine
rather than to bisect it.
