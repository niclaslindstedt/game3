---
title: rules.ts is AT the 1000-line cap — an amendment to an EXISTING rule puts its table next door, not its prose in another chapter
date: 2026-09-16
scope: engine/mapgen/rules.ts, tests/docs_rules_test.ts
concepts: [rules, file-size, docs, mirror]
---

`engine/mapgen/rules.ts` is exactly 1000 lines on `main`, so any real amendment
to a rule fails `tests/file_size_test.ts` before the work is finished. AGENTS.md
points a NEW rule's prose at `pace.ts`, but that is the wrong hatch for an
amendment: R26's prose has to stay beside R1–R28's or a reader of the rule book
finds half of it.

What worked: move the rule's TABLE next door and fold it back in under the same
name. `engine/mapgen/rules-river.ts` exports `RIVER_RULES` / `FLOW_RULES` and
`LEVEL_RULES` carries `river: RIVER_RULES, flow: FLOW_RULES`, so every
`R.river.x` reader is untouched — the `defs/sea.ts` pattern, and it freed 95
lines at once.

It is NOT a fourth chapter: `tests/docs_rules_test.ts` reads prose out of
`CHAPTERS = [rules.ts, rules-circuit.ts, pace.ts]`, so a rule STATED in the new
file would silently never be mirrored. Say so in the new file's header, and
leave the prose where the test can see it.

Regenerate the doc mirror from the code rather than hand-editing it — the test
compares whitespace-squashed prose, so extracting R26 with the test's own regex
and rewriting the `- **R26**` bullet is exact where retyping is not.
