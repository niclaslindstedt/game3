---
title: rules.ts is AT the 1000-line cap, so a new R-rule lands in its own chapter file — register it with the doc mirror, and never hand-copy a rule into the doc
date: 2026-09-10
scope: engine/mapgen/rules.ts, engine/mapgen/rules-circuit.ts, engine/mapgen/pace.ts, tests/docs_rules_test.ts
concepts: [rules, docs, tests, file-size]
---

`engine/mapgen/rules.ts` sits on §20.5's cap exactly and there is no slack
left — R27 and R28 took it to the line, and four passes of trimming prose to
fit one more rule is worth doing once and never again. A new rule gets a
SIBLING CHAPTER: `rules-circuit.ts` (R29–R31) and `pace.ts` (R32) each carry
their own `//   Rn …` header and their own table, and `tests/docs_rules_test.ts`
reads a LIST of chapter files. Adding a chapter is one entry in that list.
Nothing downstream changes — every caller still reads one `LEVEL_RULES`.

Free the handful of lines a splice needs by moving SHAPE out rather than
prose: `Band`/`inBand`/`withinBand`/`SolidRule` went to `mapgen/bands.ts` and
`GenerateOptions` to `types.ts`, each re-exported from `rules.ts` so no import
site moved.

**Never hand-copy a rule into `docs/level-generator.md`.** Re-derive the
bullet from the code with the same regex the test uses — `^//\s+(R\d+)\s+`
plus `^//\s{6,}` continuations, whitespace squashed — and rewrite the matching
`- **R<n>** …` line. It is a five-line script and it passes first time
instead of third.

**The parser trap, which costs a silent wrong doc.** A wrapped continuation
that BEGINS with a bare rule number and a space — `//       R26 and R27 do not
apply…` — matches the head pattern, so the prose is cut off there and the rest
is filed as a new rule. The test still passes (the doc was generated from the
same parse) while the doc carries half a rule. Re-wrap so no continuation
starts with `Rn `; `R10's` is safe, because the regex wants whitespace after
the number.
