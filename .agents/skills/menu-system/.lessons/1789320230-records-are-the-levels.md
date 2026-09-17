---
title: A record row is named by the LEVEL and the mode, never by what the rider chose on the same water — and an honest run is the only one that posts
date: 2026-09-13
scope: pwa/src/game/records.ts, pwa/src/App.tsx, pwa/src/game/new-game.ts, pwa/src/game/menu-levels.tsx
concepts: [records, settings, start-card, modes, storage]
---

The record book (`records.ts`) is the sibling rally game's per-stage `best`
with a seed where it has a level id, and its two rules carried over intact:
a row is keyed by what the level IS — coast, seed, track kind, the class the
course was paced for (R32 makes two classes two courses), plus a tricks
run's length — and by nothing the rider picked on the same water (craft,
hour, wind, sky), because a book partitioned by everything that changes a
time holds one run per row. The hull that set the row is WRITTEN ON it
instead. A tie is not a record.

Two things the app has to guard that the policy module cannot: the run must
be the PLAYER's (`playerRides`), and it must be honest — no staged scene, no
developer wind or sea. `App.tsx`'s `settle` checks all four before the row is
touched. And the book is written through a REF as well as React state, so a
second finish inside one render still reads the row the first one set.

Shown in two places only: on each shore's box on the LEVEL card
(`menu-levels.tsx`), and the result plate over a finished run. The key itself
is built once, beside `gameFor` in `new-game.ts` — the two are the same
question asked twice (settings → run, settings → row), and a row keyed off
anything the run was not actually ridden on is a book nobody can compare.
