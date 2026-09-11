---
title: When main made the SAME change while you were open, `git rebase --skip` that commit — resolving it replays a decision twice and leaves two changeset fragments saying one thing
date: 2026-09-11
scope: .changes/unreleased, pwa/src/game/settings-input.ts
concepts: [rebase, parallel-work, changesets, resolution]
---

Two sessions were told the same thing an hour apart, so a PR moving RESTART
THE RUN from ENTER to B rebased onto a main that had already moved it. The
middle commit of three conflicted in one file and every hunk of it was a
decision main had already taken.

`git rebase --skip` is the answer, not a resolution. Fold whatever the
first commit needs into the FIRST commit's resolution (there the branch's
new file had to ship main's layout: `restart: ["KeyB"]`, `shot: ["Enter"]`),
skip the duplicate, and re-add afterwards only the parts that were the
branch's own — a test case, worded against the merged reality rather than
the one it was written for.

**The changeset fragment is the half that bites.** Both sides wrote one, so
skipping the commit leaves main's entry standing alone, which is right: two
fragments describing one change become two lines in one release. Check
`.changes/unreleased/` after any rebase where the subjects overlapped, and
delete or re-word your own rather than letting both ship.

And prove the MERGED behaviour, not each half: here main's feature had to be
reachable through this branch's page, so the check was moving the shutter to
another key and seeing ENTER file nothing and that key file a picture. A
counting probe over `indexedDB.open("guessed-name")` cannot say that —
opening a database that does not exist CREATES an empty one, so it answers
0 rather than "not there". Ask `indexedDB.databases()` for the real name at
the moment you count.
