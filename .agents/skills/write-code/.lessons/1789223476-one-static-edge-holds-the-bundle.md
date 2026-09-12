---
title: One static import held three.js in the entry chunk — trace the edges before golfing bytes, because the critical path is a graph question, not a size question
date: 2026-09-12
scope: pwa/src/App.tsx, pwa/vite.config.ts, scripts/check-seo.mjs
concepts: [bundle, critical-path, code-splitting, three, measurement, check-seo]
---

`check-seo` had been failing PRs over tens of bytes, and two sessions' worth
of slimming bought ~60 of them back. The actual problem was one line:
`App.tsx` imported `createRenderer` statically, and that single edge dragged
three.js and 36 render modules into the entry chunk. Making it
`await import("./game/renderer.ts")` took the critical path from **963 KB raw
/ 300 KB gzip to 306 / 114** — a 62 % cut, against ~60 bytes for a day of
golfing.

**Find the edge instead of guessing.** A ~40-line script that walks static
imports from `main.tsx` (skipping `import type` and `import(`) and asks which
of them transitively reach `three` answered it in one run: exactly one did.
Grepping for `from "three"` does not — 36 files matched, none of them the
one to change.

Two mechanics worth knowing before proposing a fix here:

- **`manualChunks` does not help this budget.** A statically-imported manual
  chunk still gets a `<link rel="modulepreload">`, and check-seo counts the
  entry plus everything preloaded. It is useful for MEASURING (a throwaway
  `manualChunks` rule is how three.js was priced at 509 KB / 127 KB) but only
  a genuine dynamic import leaves the critical path.
- **Keep the types static.** `import type { FrameCost, GameRenderer }` is
  erased, so the ref can stay typed (`useRef<GameRenderer | null>`) with no
  runtime edge. Gate the effect on the loaded module (`if (!canvas ||
  !renderKit) return;`) and give it that module as its dep — the body does
  not have to become async, which matters when the file is 975 lines against
  a 1000-line cap.
