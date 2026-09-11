---
title: `defs/tuning.ts` sits AT the §20.5 cap — a new TUNING block goes in a sibling defs module folded in under the same name, never behind an exemption marker
date: 2026-09-11
scope: engine/game/defs/
concepts: [tuning, file-size, defs, engine]
---

Adding a block to `engine/game/defs/tuning.ts` will put it over a thousand
lines, and `tests/file_size_test.ts` fails with the whole file named. Do not
shave the new block's prose down to fit — that leaves the file one line from
the wall for the next session — and do not reach for §20.5.1's
`game-spec:allow-large-file` marker: NO file in this tree uses one, and a
tuning file is not the place to claim the first.

The established move is already in the file's own header: state the block
NEXT DOOR and fold it into `TUNING` under the name the repo already spells
it by, so no caller changes. `defs/assist.ts` → `TUNING.assist` was the
first, `defs/sea.ts` → `TUNING.sea` / `TUNING.wind` the second. Peel along
an OWNERSHIP line — one subject, one skill, one lab — rather than by line
count, `as const` on the sibling so the literal types survive the spread,
and update the header's list plus `AGENTS.md`'s "a number that shapes the
FEEL" row. It is mechanical and behaviour-preserving; keep it as its own
commit so the feature's diff stays readable.
