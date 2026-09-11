---
title: Two sounds for ONE event is a second decision function beside `soundForEvent`, never a second bank entry per combination
date: 2026-09-11
scope: pwa/src/game/audio/route.ts, pwa/src/game/audio/index.ts
concepts: [route, bank, events, one-shots]
---

`soundForEvent` returns at most one `{ id, shape }`, and the rung table is
about which sound a moment IS. When a moment needs a second voice laid over
the first — a landing that also took the run's longest flight — do not fold
it into the rung: a bank with `land_soft`, `land_hard`,
`land_soft_record`, `land_hard_record` is four copies of two sounds.

`bubblesForEvent` is the pattern already in the file: a separate exported
pure function asked about the SAME event, played after the main sound in
`index.ts`'s `events()` loop. `recordForEvent` is the second one. The
landing still sounds like the landing it was — sized by its descent — and
the news is its own def.

Mix it in the band the thing underneath is NOT in. A splash is brown and
pink, all body and no top; the chime over it is thin sines with no body at
all, which is what lets it read at ~9 dB under the landing it plays with.
`make audition ARGS=--meter` is how that is checked: the record chime wants
to land between the course chimes and the finish, nowhere near the water.
