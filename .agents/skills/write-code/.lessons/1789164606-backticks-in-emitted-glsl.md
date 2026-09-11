---
title: A backtick-quoted identifier inside an emitted-GLSL template literal ends the literal — escape it or reword, and the parse error points at the comment, not at the backtick
date: 2026-09-11
scope: pwa/src/game/starfield.ts, pwa/src/game/sky-glsl.ts, pwa/src/game/cloud-field.ts, pwa/src/game/water-shader.ts
concepts: [shader, glsl, comments, three]
---

The shader modules emit GLSL from a template literal, and the GLSL carries
prose comments written in this repo's usual voice — which quotes identifiers
in backticks. Inside the literal a backtick CLOSES it, and what follows is
parsed as TypeScript. Writing

    // Folding \`i.x\` is the whole trick

in `starfieldGlsl`'s returned string fails with `Expected ';', got 'i'`
pointing at the COMMENT LINE, which reads as a broken comment rather than as
an unterminated string; it cost two round-trips to see. The same edit made in
a doc comment ABOVE the function is fine, which is what makes it easy to do
by habit.

Two ways out, both already in the tree: escape it (`sky-glsl.ts` writes
\`blur\` in its in-shader comment), or reword to name the thing in plain
words. Prefer the rewording inside GLSL — an escaped backtick is noise in a
comment a reader meets as shader source.

Worth a glance before running anything: after editing an emitted-GLSL block,
`npx tsc --noEmit` catches it in seconds, and it is the ONLY check that
does — the error never reaches the browser, because the module does not parse
at all.
