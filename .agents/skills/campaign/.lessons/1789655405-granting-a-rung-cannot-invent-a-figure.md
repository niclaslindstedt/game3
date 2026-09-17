---
title: A granted campaign rung must carry NO figure — `LevelResult` merges the best time with the clear, and the record book is what makes a LOCK safe
date: 2026-09-17
scope: pwa/src/game/campaign.ts, pwa/src/game/menu-campaign.tsx, pwa/src/game/run-news.ts
concepts: [campaign, locks, progress, records, developer-menu]
---

`CampaignProgress.results` is one row per level carrying BOTH what opens the
next rung (`place`, `medal`) and what the box quotes (`best`, `craft`). So
anything that opens a rung without riding it — the developer page's UNLOCKS —
has to write half a row, and the honest half is the lock's: `best` and `craft`
are an OPTIONAL PAIR that a grant leaves absent. Inventing a `best` puts a lap
time on the card that nobody rode; making the row required instead forces the
grant to fabricate one. Three readers have to be taught the pair may be
missing: the box's figure mark (`menu-campaign.tsx`), `recordRun`'s better-
afternoon test, and `campaignResultFor`'s NEW BEST test in `run-news.ts` — all
three read `stood.best` and all three are correct with `stood?.best === undefined`
meaning "the first run down it sets one". `mergeProgress` keeps the strict rule
for a row that CLAIMS a figure (a bad `best` or an unknown `craft` still drops
the whole row) and accepts only a row claiming neither.

The other half is why a LOCK is allowed to delete a result at all: the campaign
result is one afternoon on a rung, and the player's actual best down a shore in
a mode lives in `records.ts`, a different store the locks never touch. Check
that separation before writing anything that clears progress — it is what lets
LOCK EVERYTHING be a real reset rather than a destroyed save.

Both presses must work on a PREFIX of `SHORES`, because `shoreUnlocked` reads
"the one before it was WON": unlock wins up to and including a shore, lock
undoes from it on. Anything else can leave a shore standing open behind one
that has never been ridden, which is a board the campaign itself would never
deal.
