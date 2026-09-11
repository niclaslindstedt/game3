---
title: A named hour added OUTSIDE the daylight window needs a circular gap in `dealtTimeOfDay`, and can never be the start card's mark
date: 2026-09-11
scope: engine/mapgen/daytime.ts, pwa/src/game/menu-start.tsx
concepts: [r13, daytime, start-card, settings]
---

`TIMES_OF_DAY` is one `as const` array and everything downstream reads it:
the start card's stops and pips, `mergeSettings`, `?time=`, `createGame`'s
`timeOfDay`. Adding NIGHT to it needed exactly two edits that do not
compile without them — the `Record<TimeOfDay, string>` of labels and one
string — plus two that do not announce themselves:

**The nearest-rung search has to measure on a CLOCK.** `dealtTimeOfDay`
walked the rungs with `Math.abs(hour - hourOfDay(...))`, which is correct
only while every rung sits inside one daylight window. A rung at midnight
puts the other three on the far side of the dial, and a linear gap then
hands the whole late evening to SUNSET (23:00 reads as 23 hours from the
night rung instead of one). One `hoursApart` helper fixes it and nothing
else changes, because for hours inside the window the two agree.

**Derive the hour, never write it down.** Night is `midday + 12` off the
same `daylightWindow` the other three are cut from — midday's opposite —
so it stays right on a coast whose solar noon is not 12:00, and costs no
new astronomy. It comes out at exactly 0 today because the sun's arc is
symmetric in solar time.

**A rung outside the window is never the MARK.** R13 draws every level's
hour from inside the daylight, so `dealtTimeOfDay` cannot return night for
a generated level and the row's mark stays on one of the three. Hold that
with a test sweeping the window in all four seasons (`sky_test.ts`) — it
only holds while the window is under ~21.8 h wide, which is a fact about
the coast's latitude, not a constant.
