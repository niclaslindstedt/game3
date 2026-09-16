---
title: A surface that only exists over a LIVE RUN cannot be reached by `?menu=`, so shorten whatever makes it slow in a throwaway build and photograph it — shipping one unphotographed cost four layout defects in a row
date: 2026-09-16
scope: pwa/src/game/menu-bench.tsx, scripts/screenshot.mjs
concepts: [screenshots, surfaces, benchmark, layout, viewports]
---

`scripts/screenshot.mjs --surface` reaches every card the `?menu=` reader
names. The benchmark's CARD is not one of them: it exists only over a
measurement in progress, so the lab can photograph the developer page that
starts it and the history page it leads to and show neither. Shipping it on
the strength of those two cost FOUR defects found afterwards, in four
round-trips: the head printed over its own title; shortening the head's word
did not fix it (BENCHMARK is one word and cannot wrap, so it ran under the
action's border at 390 px however short the action got); `.menu-card` squeezed
its rows rather than scrolling, with `.menu-item`'s `overflow: hidden` hiding
the clipped text; and the row that fixed THAT put RUN AGAIN below the fold.

THE TRICK IS TO SHORTEN WHAT MAKES IT SLOW, not to wait it out. The card is a
finished 1800-frame run, ~50 minutes under this container's rasterizer; with
`BENCHMARK.frames` cut to 30 in a throwaway build it arrives in under a
minute, and the layout is identical because the plan's length changes nothing
about the card. Shoot both viewports, then restore the shipped value and
`grep` it back on disk before the next build — that number is the measurement,
and a leaked 30 would be a benchmark nobody could compare.

Measure the thing that matters WHILE the page is up, in the same
`page.evaluate`: the way ON's bottom against the card's (`againBelowFold`),
`scrollHeight - clientHeight`, and the billing's line count. Those three turn
"it looks off" into a number that can be compared across rounds.
