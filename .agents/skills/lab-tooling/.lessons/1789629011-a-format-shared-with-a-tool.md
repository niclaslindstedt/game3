---
title: A data format a lab WRITES and the app READS lives in the app module, both halves together — `tests/imports_test.ts` forbids the suite importing `scripts/`, and `btoa` is the base64 both runtimes have
date: 2026-09-17
scope: scripts, pwa/src/game, tests/imports_test.ts
concepts: [tooling, testing, generated-artifacts, campaign]
---

The sibling rally game puts a committed artefact's encoder in
`scripts/lib/`, shared by the tool that writes it and the test that checks it.
That does not port: §23.7's "nothing imports tooling" is a live case here
(`imports_test.ts` → "nothing imports tooling"), so a test importing
`scripts/lib/*.mjs` fails the suite — and `tsc` fails it first, TS7016, since
the root tsconfig has no `allowJs`.

The arrow already runs the other way: tooling imports the app. So the encoder
goes in the app module that DECODES it, and the tool reaches it the documented
way — `aliasEngine(root)` then `await import(join(root, "pwa/src/game/…ts"))`.
That turned out better than the split it replaced: an encoder and its inverse
stated apart is the format written twice, and two halves that quietly disagree
ship a card full of plausible wrong shapes. Nothing in the app calls the
encoder, so the bundler drops it.

The one thing to get right when a function has to run in both: no `Buffer`.
`btoa`/`atob` and `String.fromCharCode` are in the browser AND in Node, so one
statement serves both — and the port is checkable, because re-running the tool
after the move must leave the committed module byte-for-byte identical.

And the receipt: a POLYLINE can be recomputed and compared, a JPEG cannot. So
a committed picture ships a data module saying what it is a picture OF (the
level, the seed, the day), which is the only thing that can ever notice it has
gone stale — the test then holds that receipt against the source of truth.
