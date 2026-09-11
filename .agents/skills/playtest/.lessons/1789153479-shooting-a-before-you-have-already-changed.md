---
title: To photograph the BEFORE of a change already made: stash, build, shoot, pop — and make no edits while the stash is outstanding
date: 2026-09-11
scope: scripts/screenshot.mjs
concepts: [screenshots, preview, renderer]
---

`make screenshots` drives `pwa/dist`, so the before shot has to come off a
build of the old code. Once the change is written that build is gone, and the
sequence that gets it back is `git stash push -u`, `make build`, shoot into a
directory outside the tree, `git stash pop`, `make build`. Two traps:

- **Edit nothing while the stash is outstanding.** A file touched in that
  window that is also in the stash makes `pop` a conflict in the middle of a
  session that has no commit to fall back to. Write the docs and the changeset
  before the stash or after the pop.
- **`--camera <rung>` renames the file.** A shot taken with `--camera bow`
  lands at `previews/shot-<scene>-bow-desktop.png`, not
  `shot-<scene>-desktop.png`; copying the latter hands back the previous
  shot and the comparison silently shows one picture twice. The same is true
  of `--surface` and `--update`. Check `ls -t previews/` after the run rather
  than assuming the name.

Cheaper than either when the subject is one material: reproduce its maths in
a scratch Node script and paint the raw channels. The ripple tile's fault was
identified and the fix judged before the app was built at all.
