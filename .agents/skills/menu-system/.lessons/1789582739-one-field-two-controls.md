---
title: When a ladder row and a fader answer the same question, store ONE field of the FADER's type and make the ladder's stop ids the figures
date: 2026-09-16
scope: pwa/src/game/settings.ts, pwa/src/game/menu-start.tsx, pwa/src/game/new-game.ts
concepts: [settings, options, start-card, knobs]
---

FREE's card asks for the wind as a figure where the other three ask for it as
one of three words. The tempting shape is two stored fields (`conditions` and
`windMs`) and it is the wrong one: something then has to decide which wins, and
that decision gets restated everywhere the wind is read.

What worked: **one field, in the fader's units** (`ride.wind`, m/s), with the
ladder's `Stop.id` being `String(CONDITION_DAY[rung].wind)` — the id IS the
answer, which the WAVES row was already doing with `String(rung.hs)`. Both
controls then write the same field and nothing has to choose.

Two things that shape needs:

- **A figure → rung reader**, and the CARD must show the rung it will actually
  ride. `conditionsFor` / `seaStateFor` already existed for the dealt mark; the
  worded row now also displays `windAsRung(stored)`, so a 33 m/s gale set on a
  free ride does not leave the ladder standing on nothing.
- **The measured path snaps.** `gameFor` puts the figure back on its ladder for
  every mode but the free one, so what a worded row says and what the run rides
  cannot disagree. Without it the loose figure follows the rider into a timed
  run under a row that cannot state it.

The merge then checks a RANGE rather than a list (`inRange(value, FREE_WIND_RANGE)`),
which also, for free, drops a blob from the build whose wind was a WORD.
