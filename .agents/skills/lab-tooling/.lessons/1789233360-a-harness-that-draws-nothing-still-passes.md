---
title: A harness page whose SIZE comes from the app stylesheet draws nothing until that rule exists — and the lab reports success either way
date: 2026-09-12
scope: scripts/glyph-preview.mjs, pwa/src/tools/glyph-preview.tsx
concepts: [tooling, screenshots, verification, layout]
---

`make glyphs` renders the real `<Glyph>` component and counts `.cell`s to
prove it drew something. The first run printed `(4 marks)` and the sheet came
back as four EMPTY plates: the SVGs were in the DOM, but an inline SVG with
no CSS size at all collapses to zero, and the rule that sizes them
(`.menu-glyph { width: 1em }`) had not been written yet. Nothing threw and
nothing warned.

Two things follow for any harness page that renders an app component rather
than drawing on a canvas:

- **The count is not the check — the PICTURE is.** A guard that counts cells,
  rows or elements proves the component mounted, not that it painted. Read
  the sheet before believing a lab that says it worked.
- **Import the app's own `styles.css` in the harness and never restate a rule
  in it.** The sheet is only evidence if the mark is the size the card gives
  it.

And the one-off vite build for a PREACT harness needs two options the
existing `.ts` pages (`flora`, `sky`, `birds`, `wake`) do not:
`esbuild: { jsx: "automatic", jsxImportSource: "preact" }`, or the `.tsx`
fails to compile, and `cssMinify: false`, or importing the app stylesheet
raises a page of warnings about Tailwind at-rules this build cannot expand.
