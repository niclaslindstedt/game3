---
title: A control read off an input's SHAPE fires for every controller that moves that input — measure the BOT before believing the feel
date: 2026-09-12
scope: engine/game/craft.ts, engine/sim/bot.ts
concepts: [arcade, dead-band, flight, bot, sim, measurement, game-feel]
---

The pump reads the lean-back input's SHAPE — a rise above its own low-water
mark is a haul — rather than its value. That is what lets one key be both
the hold and the taps, and it is also why it fires for anything that moves
the axis at all. `make sim` found what a bench never would: the bot's
levelling PD asks for 0.2–0.8 of lean back once or twice a run, was handed
2.8–5.5 rad/s of nose-up it never asked for, and the roster lost 4–7 km/h of
pace and a fifth of its gates. Every hand tried on the bench — hold, tap,
hold-then-tap — was a hand that MEANT it.

Three fixes, in the order they are worth reaching for:

- A DEAD BAND ON THE DEPTH. Pay a stroke by how far back the bars went —
  nothing at the threshold, all of it at twice the threshold — so a flick to
  trim the nose is worth nothing and a committed haul is worth the lot.
- A FLOOR BETWEEN STROKES. A controller is not a hand: a raw PD output
  oscillates at tens of hertz and every upswing read as a fresh stroke.
- THE RIGHT STATE TO FIRE IN. "Airborne" was wrong three times over: a hull
  leaving a lip lifts a probe clear while the deck still has it, a hull
  CROSSING a deck hops off and back (a whole launch and landing in the
  bookkeeping), and a hull dropping off a crest is not a jump. Each clause
  came from a measurement, not from reading the code.

Where the bot legitimately wants the input for something else, cap it there
and say so in `docs/simulation.md`.
