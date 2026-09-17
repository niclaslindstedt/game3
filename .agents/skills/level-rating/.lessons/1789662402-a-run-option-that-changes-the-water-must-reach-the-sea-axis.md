---
title: Every `RunConditions` field has to reach the axes it can move — the season was steering the sun and not the sea, and only a freezing coast showed it
date: 2026-09-17
scope: engine/rating/index.ts, engine/game/ice.ts, engine/game/water.ts
concepts: [rating, conditions, season, ice, r37, sea]
---

`RunConditions` is the four things a campaign level pins that the generator
would otherwise deal, and `rateLevel` was routing three of them (hour, season,
weather) to the DAY's axes and only the wind to the sea. That reads as correct
until a coast's own water depends on one of the other three: R37 makes the
arctic's sea a sheet of ice in its winter, `frozen(level)` answers off
`level.season`, and `createSea` was being handed the raw level — so a rung
pinned to winter was rated against the sea the SEED was dealt.

The general rule: when a condition can change the WATER and not just the light,
lay it over the level before the sea is built, exactly as `createGame` does
(`{ ...level, season: conditions.season }`). The give-away that it is not
wired is a stat that will not move: re-rate one seed under two seasons and
compare `stats.hs`, not the index — the index folds eight axes and a wrong sea
hides inside a moving `dark`.

And the axes are not complete just because they are honest. With the sea read
correctly a winter arctic level caps near 0.55, because none of the eight
measures the thing that actually makes it hard — the hull grounding on the
sheet either side of the channel. Adding a ninth axis means recalibrating every
weight, so until then such a level is PLACED on the schematic and the map
(`make level … ARGS=--season=winter`) and the index is read as a floor.
