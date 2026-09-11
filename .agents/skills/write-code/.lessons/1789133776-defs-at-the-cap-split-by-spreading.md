---
title: A defs file at the 1000-line cap grows by moving one SUBJECT into a sibling const and spreading it back in — `TUNING.x` keeps its spelling and no caller is touched
date: 2026-09-11
scope: engine/game/defs/
concepts: [file-size, tuning, refactor, defs]
---

`engine/game/defs/tuning.ts` is kept close to the §20.5 cap, so a single new
tuning number — with the comment every number here owes — can fail
`tests/file_size_test.ts` before it fails anything else. The marker the test
accepts is not the answer: the file is at the cap for a reason and an
exemption is forever.

The split is by SUBJECT, not by size: lift one top-level block out to
`defs/<subject>.ts` as an exported const and spread it back into `TUNING`
(`assist: ASSIST`, as `defs/assist.ts` does). Every reader still spells it
`TUNING.assist.strength`, no import moves, no test changes, and the new file
carries the block's own prose. Pick a block that is a whole subject and that
nothing else in the file reads.

Two things to keep: a line in the parent's header saying the subject is
authored next door, and a line in the new file saying nothing imports it but
the parent, or the next session will wonder whether it is a second public
surface. And check `origin/main` before splitting: a file at the cap is a
file somebody else is about to hit too, and two sessions splitting the same
one differently is the one conflict in this tree that cannot be resolved by
keeping both sides.
