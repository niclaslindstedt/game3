---
title: A campaign rung on a coast that FREEZES has to be rated on the season the run pins, and the index still has no term for the channel
date: 2026-09-17
scope: engine/rating/index.ts, pwa/src/game/campaign-levels.ts, engine/game/ice.ts
concepts: [campaign, rating, ice, r37, season, arctic, curation]
---

`rateLevel` takes `RunConditions` — an hour, a season, a sky, a wind — and used
them for the SUN while handing the raw `Level` to `createSea`. That is the same
answer on every coast but one: `frozen(level)` reads `level.season`, so a run
pinned to the arctic's winter was rated against an OPEN SEA while the run
itself is ridden down a channel cut through two metres of ice (R37). The error
is in the worst direction for a ladder — it reads the flattest water on the
coast as the biggest, so a sorted sweep puts an ice level at the TOP. The fix
is one line of the move `createGame` already makes: lay the run's season over
the level (`{ ...level, season: conditions.season }`) before building the sea.
Nothing on a coast with `freezes: false` moves, so no existing digest or index
did.

What the fix does NOT buy is a rating that understands ice. With the sea axis
honest, a winter arctic rung tops out near 0.55 however hard it blows — the
index has no term for a hull grounding on the sheet when it leaves the lead, and
the eight axes would need a ninth (and a recalibration of all the weights) to
get one. So a frozen shore is placed by LOOKING: `make level SEED=n
BIOME=arctic ARGS=--season=winter` draws the sheet with the channel through it,
and that picture is what says whether the channel is a real ask. On seed 2 it
is — the tightest line on the coast with the ice on both sides of it — and the
rung sits mid-ladder at 0.494 rather than as a finale.

The bot copes with the sheet (its shoal probe reads `iceAt` first), but PROVE it
per level: ride the pinned day, not the seed's own, because `make sim` deals the
seed's season and a frozen rung is never the one it deals.
