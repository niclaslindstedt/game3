---
title: rules.ts is AT the 1000-line cap, so a new R-rule lands in a second chapter file — and a continuation line that starts with a bare `Rn ` silently truncates the prose the doc mirror compares
date: 2026-09-10
scope: engine/mapgen/rules.ts, engine/mapgen/rules-circuit.ts, tests/docs_rules_test.ts
concepts: [rules, docs, tests, file-size]
---

`engine/mapgen/rules.ts` sits on §20.5's cap exactly, so there is no room in
it for another rule's prose. The pattern that worked: a sibling chapter
(`rules-circuit.ts`) carrying its own `//   Rn …` header AND its own table,
spliced into the one rule book as `LEVEL_RULES.circuit`, with
`tests/docs_rules_test.ts` taught to read a LIST of chapter files rather
than one. Nothing downstream changes — every caller still reads one
`LEVEL_RULES` — and the contiguous-numbering assertion still holds across
both.

Free the handful of lines the splice needs by moving SHAPE out rather than
prose: `Band`/`inBand`/`withinBand`/`SolidRule` went to `mapgen/bands.ts`
and `GenerateOptions` to `types.ts`, each re-exported from `rules.ts` so no
import site moved.

**The parser trap, which costs a silent wrong doc.** `docs_rules_test.ts`
reads a rule as `^//\s+(R\d+)\s+(.*)$` and its continuations as `^//\s{6,}`.
A wrapped line that happens to BEGIN with a bare rule number and a space —
`//       R26 and R27 do not apply…` — matches the head pattern, so the
prose is cut off there and the rest is filed as a new rule. The test then
passes (the doc was generated from the same parse) while the doc carries
half a rule. Re-wrap so no continuation starts with `Rn `; `R10's` is safe
because the regex wants whitespace after the number.
