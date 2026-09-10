---
title: Never name a field or a variable `window` in engine/ — imports_test reads `window.` as a DOM global and fails with the whole file dumped at you
date: 2026-09-10
scope: engine/
concepts: [tests, imports, naming, dom]
---

`tests/imports_test.ts` holds the engine to being framework- and DOM-free by
matching `/\b(window|document|navigator|localStorage)\./` over the source. A
perfectly innocent options field — `ask.window.from`, the stretch of line an
air gate's window may take — is a member access on `window` as far as that
regex is concerned, and the failure prints the whole surrounding function
with "a DOM global" and no hint of which word it means.

The test's own comment says `window` is a fine name for a search window,
which is true of the BARE word and not of `window.<anything>`. So: a local
`const window = …` is safe, a property named `window` is not. Rename the
property (`room`, `span`, `reach`) rather than widening the regex — the
check is worth more than the word.
