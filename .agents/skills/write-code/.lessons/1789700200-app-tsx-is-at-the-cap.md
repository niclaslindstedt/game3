---
title: `pwa/src/App.tsx` sits AT the §20.5 cap, so any new surface wiring has to pay for its own lines before it can land
date: 2026-09-17
scope: pwa/src/App.tsx, tests/file_size_test.ts
concepts: [file-size, app, refactor, comments]
---

App.tsx was 998 physical lines of a 1000-line cap. That is not headroom — a
new layer over the canvas is a prop or two, a ref, an import and a comment,
which is twenty lines, and `tests/file_size_test.ts` fails before anything
else does. Budget for it BEFORE writing the wiring, and never reach for the
`game-spec:allow-large-file` marker to get out of it: the test refuses a
marker on a file under the cap precisely so a badge cannot be parked there.

What paid for a finish plate's layer, in the order worth trying:

1. **Move a closure to the module that should already own it.** The restart
   closure in `createRunActions`' world became `restand` in
   `createRunSurfaces`' — five lines in App.tsx for one, and the concept
   landed where the other ways out of a run already live.
2. **Collapse a rule stated three times into one statement.** Three JSX
   comments each explained "outside the HUD's switch, because a readout
   switch must not take X away". One header over all three and a pointer on
   each is shorter AND is what this repo asks for anyway.
3. **Let the component own its own gate.** `<ResultPlate result={... : null}>`
   returning `null` internally beats `{a && b && <Plate/>}` wrapped in a
   layer div in App.tsx, and puts the one rule about when the card is up in
   the file the card lives in.

Measure with `grep -c "" <file>` — the test counts newlines, which is what
`wc -l` counts and is NOT what an editor's last line number says.
