---
title: An event that fires every few seconds AND once a run at a hundred times the size is one def with its floor in the ROUTE — and two independent facts get two independent axes, never a sum
date: 2026-09-12
scope: pwa/src/game/audio/route.ts, pwa/src/game/audio/bank.ts
concepts: [route, bank, mixing, one-shots, scoring]
---

The trick score's `combo` banks at the end of EVERY counted flight: one a
second at worst, one every five seconds in a bot's run, and the purse spans
40 points for a one-second hop to 5,876 for a double backflip. The instinct
is two defs, or a rung that returns null under a threshold. Both are wrong —
the second one breaks the coverage guard, and the first is the "nine landings
that are the same four voices" fault the route's own header warns about.

One def, authored at its BIG size, with a floor in the `PlayShape`:
`floor + (1 - floor) * ramp(points, 0, FULL)` at `floor = 0.25`. The trivial
bank comes out at ~0.65 gain — a tick under the beds — and the big one at
~1.4. That is the same shape `land` already uses for its descent, and it is
the general recipe for any moment whose size is unbounded.

THE SECOND HALF IS THE USEFUL ONE. The event carried two facts that mean
different things — the purse (how much) and the multiplier (how well) — and
summing them into one "bigness" throws away exactly the distinction a player
cares about. Give each its own axis: points → `gain` and `stretch`,
multiplier → `pitch`. A big dumb pile of air time is loud and low; a small
combo taken at ×4 is quiet and bright; nobody confuses them. Metered, the
pair lands between `air_record` and `finish` and nowhere near the water.
