---
title: engine/mapgen/rules.ts now sits at exactly 1000 lines — the next R-rule breaks §20.5's cap and needs the file split, not another round of prose-trimming
date: 2026-09-10
scope: engine/mapgen/rules.ts
concepts: [rules, file-size, docs]
---

R27 and R28 took the rule book to the line. `tests/file_size_test.ts` failed
at 1021 and came back green only after four passes of cutting sentences out of
the new rules' prose and out of the tuning comments beside them — which is
worth doing once and is not worth doing again: the next rule will need ~15
lines and there is no slack left.

The split to reach for is the R-rule HEADER, not the data. `tests/docs_rules_test.ts`
reads the ids off `rules.ts`'s `// R<n> …` comment block and holds
`docs/level-generator.md` to it verbatim, so a second file carrying the later
rules' prose has to be added to that reader too — one line there, and the mirror
keeps working.

Practical note for the mirror: do not hand-copy a rule into the doc. Re-derive
every bullet from the code with the same regex the test uses (`^//\s+(R\d+)\s+`
plus the indented continuation lines, whitespace squashed) and rewrite the
matching `- **R<n>** …` lines; it is a five-line script and it makes the docs
test pass first time instead of third.
