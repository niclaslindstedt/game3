---
title: A file near the 1000-line cap needs a concern split, not shorter comments
date: 2026-09-10
scope: pwa/src/App.tsx, pwa/src/game/url-params.ts, pwa/src/game/scenarios.ts, pwa/src/game/scenario-names.ts
concepts: [file-size, split, app, scenarios, catalog]
---

A thirty-line hook in the frame loop tipped `pwa/src/App.tsx` over
`tests/file_size_test.ts`'s cap. Trimming the new code's comments to squeeze
back under would have left the next change to hit the same wall, so the
answer was a sibling module: the URL readers (`Params`, `readParams`,
`settingsFor`) became `pwa/src/game/url-params.ts`, with `readParams` taking
the query string as an argument the way `splash.ts` does. After the move,
prune `App.tsx`'s import list — a dozen `@engine` and ladder imports were
only ever used by the readers, and eslint names each one.

The same collision happened when `main` and a feature each added scenarios:
the combined `scenarios.ts` reached 1008 lines although neither branch did.
Its name tuple, derived union and guard were already one leaf concern, so
they moved to `scenario-names.ts` and `scenarios.ts` re-exported them. That
kept every caller stable and restored useful room without weakening the
descriptions that make staged moments maintainable.

`AGENTS.md`'s sync table and the `menu-system` skill both name where the
readers live, so a move there updates both in the same PR.
