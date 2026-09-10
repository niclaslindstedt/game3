---
title: A row that defers to the level marks the dealt answer and stores null — and only a DRIVEN browser can check it, because every screenshot catches the one state where the mark and the selection are the same value
date: 2026-09-10
scope: pwa/src/game/menu-start.tsx, pwa/src/game/menu-knobs.tsx, pwa/src/game/seed-preview.tsx
concepts: [start-card, settings, screenshots, seed-preview, options]
---

`settings.ride`'s rows are null-means-the-level's-own, and the row says which
answer that is rather than offering a stop for "whichever one it is":
`StepRow` takes `dealt`, marks that value and rings its pip, and landing back
on it stores null again. Two things this needs that are easy to miss.

THE DEAL COMES BACK WITH THE CHART. Which hour/wind/sky a seed gives is a
fact about the generated level, so it rides on the worker's reply
(`SeedDeal` in seed-preview-worker.ts) and the start card holds the hook
(`useSeedPreview`) while `SeedPreview` only draws what it is handed. One
seed, one level, one answer — a second opinion computed on the card would
drift from the picture under it. The engine owns the naming
(`dealtTimeOfDay`, R13's window is per-coast); the app owns only
wind-figure → rung (`conditionsFor`).

WEATHER's mark follows the WIND ROW, not the level, whenever a wind is
chosen: `CONDITION_DAY[conditions].weather` is what rides when the sky row
is left alone, so marking the level's sky there would mark a sky the run
will not use.

VERIFY BY DRIVING. `make screenshots --surface start` can only ever
photograph the untouched card, where the marked value IS the active one —
every interesting state (override, back to the mark, the mark moving as the
seed is walked, the row dimmed while the worker catches up) is one press
away and invisible to the lab. A scratch playwright script reading
`.knob-word` / `.knob-mark` / `.knob-pip-dealt` per row plus
`localStorage["sea-haven-settings"]`, walking attract → START → the rows →
CRAFT → RIDE → Escape, proves the cycle and that `__SH_COST__.frameMs` never
stalls. Import playwright from `node_modules/playwright-core` and serve
`pwa/dist` yourself; a script outside the repo resolves neither by name.
