---
title: Take the lab's BEFORE output before the first edit — recovering one afterwards with `git checkout <file>` destroys the session's own uncommitted work
date: 2026-09-11
concepts: [labs, screenshots, measurement, git, workflow]
---

This skill's workflow says to run the lab before and after and put both in the
PR. The trap is doing it in the other order: having already made the change,
"just revert the two numbers for one shot" is tempting, and the obvious way to
restore afterwards — `git checkout pwa/src/game/<file>.ts` — takes the file back
to **HEAD**, not to where the session had it. On a file whose changes are not
yet committed that silently deletes the whole session's work on it: in this pass
it took out four edits, and only the test suite passing by luck made it
obvious.

Two ways out, in order:

1. **Shoot the before-output first**, right after the preflight and before the
   first edit. It costs one build and nothing else.
2. If a before-output has to be recovered later, copy the file aside first
   (`cp <file> /tmp/…`), edit, shoot, and restore with `cp` — never with a git
   command. `git stash` has the same hazard in a session that is also holding
   other uncommitted work.

The same applies to the labs that drive the BUILT SITE (`screenshots`,
`profile`): each before/after pair costs a `make build`, so deciding the
comparison up front saves two of them as well.
