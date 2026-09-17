---
title: A regime on the OTHER side of the surface is built as the flight's mirror — a latch with a gap, a clock, a counts line, events at both ends — and a scorer that reads the end event must read it BEFORE its own branch clears what the event sells
date: 2026-09-16
scope: engine/game/submerged.ts, engine/game/craft.ts, engine/game/tricks.ts, engine/game/state.ts
concepts: [state, events, step-order, scoring, regime, hysteresis]
---

The hull under the water (`CraftState.under` / `underTime`) copies the
air's bookkeeping (`airborne` / `airTime`) piece for piece, and each piece
was needed for the same reason it was needed in the air:

- A LATCH with a gap (`enter` 0.25, `leave` 0.1 on `submergedShare`)
  rather than a threshold: a hull surfacing through a seaway has the water
  lapping its deck for a second, and one line read twice a wave cut a
  ten-second dive into twenty spells and never started the ten-second clock.
- A COUNTS line (`submerged.counts` 0.5 s, `flight.airCounts`'s twin) that
  the clock, the score and the "went under" event all start at, so green
  water over the deck is not a dive. Measured first with the bot over four
  seeds and a gale: no ordinary spell lasted half a second.
- A start event and an END event carrying the whole reading (`surface`:
  the seconds, and whether it was CLEAN) — the scorer reads the end event
  and never a state edge of its own, for the reason flights are counted
  off `launch`.
- The timers of the rule (10 s on the gas, 1 s off it) in the same stepper,
  with half a step of slack, because 120 steps of 1/120 is not 1.0.

And ORDER inside the scorer: the `surface` event arrives on the step
`under` has already gone false, so `stepTricks`'s "back on the water"
branch runs that same step and clears the air's rung. The win off the
event has to be read BEFORE the branch, or the thing it sells is gone.
Same shape for anything paid off an end event: pay first, then update the
per-step state.

Both timers came from the user's spec verbatim; what did NOT was the third
trigger — a hull that comes out of a dive on its back is floated up at
once — which the bench forced: a coasting dive corks out inverted in 0.9 s,
before a one-second clock can fire, and a rule stated only as clocks left
every unsteered dive a capsize.
