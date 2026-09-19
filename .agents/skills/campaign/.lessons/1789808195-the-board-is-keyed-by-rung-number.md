---
title: A board is keyed by RUNG NUMBER, so re-cutting a ladder renames rungs that have been ridden — store the shape and move the board
date: 2026-09-19
scope: pwa/src/game/campaign.ts
concepts: [campaign, progress, storage, locks, curation]
---

`CampaignProgress` keys `results` and `points` by `CampaignLevel.id`, and the
ids are `<shore>-<rung>`. So any change to the ORDER of a shore's levels —
inserting a rung, dropping one, swapping two — silently re-points every stored
row at whatever now holds that number. `mergeProgress`'s id check does not
catch it: the id still exists, so a race's time and place land on a tricks rung
nobody rode, and `levelCleared` reads a lock off it.

The fix that keeps the save: write the LADDER'S SHAPE beside the board
(`LADDER_VERSION`, folded into the stored blob as `v` by `saveProgress`) and
move an older board's ids onto this ladder in `mergeProgress` before the known-
id check. It only works when the move is EXACT — six rungs to eight worked
because rungs 1–3 did not move and the old 4, 5, 6 are the new 5, 6, 7, the
same seeds in the same modes. Where a re-cut cannot be expressed as a remap,
the honest answer is to drop the rows it cannot place, not to guess.

Two things that are NOT affected, and are worth not going looking for: the
record book keys on `biome/seed/track/class` and never on a level id
(`records.ts`'s `recordId`), and the stored "last level I picked" goes through
`levelForMode`, which returns null when the id no longer fits the mode. And
`mergeProgress` is what the tests round-trip through, so a case that feeds it a
bare `CampaignProgress` has to wrap it in the stored shape or it gets migrated
by accident.
