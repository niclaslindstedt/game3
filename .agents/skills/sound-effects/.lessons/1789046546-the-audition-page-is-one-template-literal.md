---
title: "The audition page's runtime script is ONE template literal — a backtick in a comment there ends it, and the page dies with a SyntaxError naming a word from your prose"
date: 2026-09-10
scope: scripts/audition.mjs
concepts: [audition, tooling, review, meter]
---

`scripts/audition.mjs` builds the page's browser-side script as a single
backtick-quoted string. Writing a perfectly ordinary code comment in there —
"the two readings the bed takes off one \`wetted\` share" — closed the
template early, and the tool then failed with
`SyntaxError: Unexpected identifier 'wetted'` pointing at the COMMENT. The
error names a word out of the prose, so it does not read as a quoting fault
at all. No backticks anywhere inside that region; say the identifier plain.
This is a second, separate trap from the CONCATENATION rule the router
already states (only `export` names cross a module's scope) — that one gives
you a page that builds clean and throws on the first button, this one does
not build at all.

And `ARGS=--meter` needs `playwright-core`, which is deliberately not a
dependency: without it the page is still written and the meter is SKIPPED
with a one-line note that is easy to read past as success. Install it with
`npm install --no-save playwright-core@1` and re-run before claiming a level.
Getting a BEFORE table means stashing only the audio files, running, popping,
and running again — the two passes are a couple of minutes each under
software rendering, so start them early and do other work meanwhile.
