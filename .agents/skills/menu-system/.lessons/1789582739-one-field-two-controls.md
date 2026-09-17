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

The shape needs a **figure → rung reader** wherever the figure is READ back as
a word: `conditionsFor` and `seaRungFor` are those, and they are what the dealt
mark, a link's `?day=fine` and a level's box on the level card all go through.

The merge then checks a RANGE rather than a list (`inRange(value, FREE_WIND_RANGE)`),
which also, for free, drops a blob from the build whose wind was a WORD.

**Since the measured modes moved onto the campaign's pinned shores, the start
card is FREE's alone and only one CONTROL is left** — the fader. What survived
is the rule above and its reader; the snap-back that used to put a free ride's
figure on the worded row for a timed run went with the worded row, because a
measured run now takes its wind from the pinned level and never reads
`ride.wind` at all.
