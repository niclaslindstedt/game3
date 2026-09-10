---
title: App.tsx sits within a few dozen lines of the 1000-line cap — a hook added to the loop is a split, and the honest carve is by concern, not by comment
date: 2026-09-10
scope: pwa/src/App.tsx, pwa/src/game/url-params.ts
concepts: [file-size, split, app]
---

A thirty-line hook in the frame loop tipped `pwa/src/App.tsx` over
`tests/file_size_test.ts`'s cap. Trimming the new code's comments to squeeze
back under would have left the next change to hit the same wall, so the
answer was a sibling module: the URL readers (`Params`, `readParams`,
`settingsFor`) became `pwa/src/game/url-params.ts`, with `readParams` taking
the query string as an argument the way `splash.ts` does. After the move,
prune `App.tsx`'s import list — a dozen `@engine` and ladder imports were
only ever used by the readers, and eslint names each one.

`AGENTS.md`'s sync table and the `menu-system` skill both name where the
readers live, so a move there updates both in the same PR.
