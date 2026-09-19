---
title: The HUD is UP behind the pause card, so any readout added to that card is a second copy of the corner — only the headline and the clock are worth repeating
date: 2026-09-19
scope: pwa/src/game/menu-pause.tsx, pwa/src/game/pause-stats.ts
concepts: [pause, hud, surfaces, screenshots]
---

`hudOver("pause")` is true: the clock, the gate count, the place chip and the
map are all still on screen behind the card. So a strip of run figures added
to the card is not new information — the first draft photographed as the
top-left corner reprinted in the middle of the screen, in the same order, with
the same words.

It does not show in code review and it does not show in a unit test. It shows
the moment you look at a screenshot of the whole frame rather than at the card.

What survives the test: the ONE figure the run is being ridden for (a standing
on a race, a score on a tricks run) and the CLOCK — a summary without them is
not a summary. Everything after those is chosen the other way round, leading
with what the corner has no standing readout for: `progress.bestAir`,
`bestLength` and `peakAltitude`, which the HUD can only flash for a moment
because a rider at speed cannot read a number that is not happening now. The
gate count and the lap fill whatever is left.

Early in a run the strip still IS the corner's reading, because nothing else
is true yet. That is the honest floor, not a bug to design around.
