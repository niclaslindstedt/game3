---
title: A new subsystem's `defs/tuning.ts` block keeps the claim, the unit and the value; the derivation goes in the subject's docs/ page
date: 2026-09-11
scope: engine/game/defs/tuning.ts
concepts: [tuning, file-size, docs, gates]
---

`engine/game/defs/tuning.ts` is the file a new system's numbers land in by
convention (`engine-system`'s own table says so), and it has twice run at
the 1000-line cap `tests/file_size_test.ts` holds it to: 909 lines before
one session and 998 after a single new subsystem block, whose first draft
blew past the cap twice.

It has since run at the cap a THIRD time: 1011 lines after a ~35-line
addition to the trick-score block. So do not trust any number a lesson
quotes — `wc -l engine/game/defs/tuning.ts` before you start, and expect the
file to be near the cap rather than far from it.

THE STANDING ANSWER IS THE SPLIT, and it is cheap: lift the block into
`defs/<subject>.ts` as an exported const and fold it back in under the same
name (`tricks: TRICKS`), so every reader still spells it `TUNING.tricks` and
nothing else in the tree moves. Seven blocks live that way now — assist,
sea, wind, wash, flight, submerged, tricks — and each took one edit plus
the import. Prefer splitting the block you are ALREADY editing over
compressing a block you are not. The WRITING RULE below still applies to
what stays behind, because it is why the file has room at all.

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
