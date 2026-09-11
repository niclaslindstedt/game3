---
title: `defs/tuning.ts` sits within ~15 lines of the 1000-line cap — a new subsystem's block must defer its argument to docs/
date: 2026-09-11
scope: engine/game/defs/tuning.ts
concepts: [tuning, file-size, docs, gates]
---

`engine/game/defs/tuning.ts` was 909 lines before this session and 998 after
one new subsystem block. It is the file a new system's numbers land in by
convention (`engine-system`'s own table says so), and it is nearly full:
`tests/file_size_test.ts` caps it at 1000 and the first draft of one block
blew past it twice.

Reaching for the §20.5.1 `game-spec:allow-large-file:` marker on the first
overflow is the wrong move — it is for files whose SUBJECT is genuinely that
big, and a badge on this one just lets the next contributor grow it further.

Write the block the other way round instead: in `tuning.ts` keep the claim,
the unit, the shipped value and the one sentence a reader needs to not misuse
the dial; put the derivation, the measurements and the sweep that chose the
number in the subject's `docs/` page, and point at it once from the block
header. That is also where it is more useful — a doc page can carry a table.

Practical order: write the long version while thinking, move it to `docs/`,
then compress the tuning block against what the doc now says. Check with
`npx vitest run tests/file_size_test.ts`, which is seconds.
