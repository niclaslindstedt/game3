---
title: A rules row stated AS another row can never grow a difference — and "no lights" is a property of the measurement, not of the mode
date: 2026-09-17
scope: engine/game/defs/modes.ts
concepts: [modes, rules, determinism, aliasing]
---

`MODE_RULES.free` was `OPEN_RULES` itself, not a copy — a deliberate and
well-argued choice (the mode a rider chooses and the rules a measurement
rides could then never drift apart), and `modes_test` pinned it with
`toBe`. What that also bought was that FREE could never carry anything the
open rules did not, and the open rules carry no countdown for a reason that
has nothing to do with riding: three seconds of held throttle at the head of
every simulated run is three seconds every digest carries. So the one mode
reached from the start card shipped with no lights, and the argument for the
alias was what kept it that way.

The fix was a spread, not a copy: `{ ...OPEN_RULES, countdown: COUNTDOWN }`.
Everything else about the row still cannot disagree; the one line that has to
differ, differs. Reach for that shape the moment a mode is "X with one thing
added" — an alias buys the no-drift property only by forbidding the
difference, and the difference here was the whole feature.

The general trap: when a constant is shared between "what a measurement
rides" and "what a rider gets", say WHICH of the two each field belongs to
before aliasing either onto the other. `countdown` is the rider's; `course`,
`tricks`, `rivals` and `limit` are genuinely shared.

Related, on naming: the lights lived in `RACE`, whose doc comment says every
number in it is the race's alone. Tricks and time trial had already been
reading `RACE.countdown` for two PRs — the comment had quietly become false,
and the number being in the wrong block is part of why free never got it.
When a second mode borrows a constant out of a mode-specific block, move it
out then, not later.
