---
title: An INSTRUMENT — anything whose position is the reading — goes in the bottom-left speed cluster; and the live space its floating figure needs is the COLUMN's to reserve, never the row gap's
date: 2026-09-13
scope: pwa/src/game/hud.tsx, pwa/src/game/hud-dial.tsx, pwa/src/styles.css
concepts: [layout, placement, portrait, instruments, hud, css, sizing]
---

The placement lesson beside this one sorts a new element by its SUBJECT. There
is a second cut that matters more once the element has a MOVING PART: a readout
is a figure and belongs with the run's other facts in `.hud-top`; an INSTRUMENT
is a thing whose position IS the reading, and it belongs with the rev bar in
`.hud-speed`. The altimeter was legible and dead as a chip — a number that said
nothing about how the sea was working until you had read two of them in a row —
and says it at a glance as a tape. The wind meter makes the same cut.
`hud-dial.tsx` is the file for them: each component is handed a share or a
bearing and paints it, while `snapshot.ts` turns engine state into the values.

**A floating figure costs room in two directions, and both are the owning
column's to pay.** The altitude figure rides the marker, centred on its line, so
half its height hangs below the track at the foot: give `.hud-alt` enough `gap`
for half a line, and shoot `SCENE=ocean` (which stands the craft in a trough)
rather than `cruise`. Sideways is worse, because the figure is `position:
absolute` — the column's content box is the CAPTION's width and says nothing
about how far right the number reaches. Reserving that on the ROW's `gap`
instead is a guess, and the guess has to be generous: a `clamp(3.6rem, 10vmin,
5rem)` gap once carried the wind meter out past both the rev bar and the speedo,
and a corner whose rows end at three different edges stops reading as one panel.
Put a `min-width` on the column, built from the widest string the readout can
print measured in the FIGURE'S OWN `em` — clone the element in the page, swap
`textContent`, read `getBoundingClientRect().width`; "188.6 m" came to 4.69 em
at every viewport — and the row's gap goes back to being a gap.
