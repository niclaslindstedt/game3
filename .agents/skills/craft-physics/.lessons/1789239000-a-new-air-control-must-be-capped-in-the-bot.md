---
title: A new air control the bot's levelling PD can trigger must be capped in the bot, and the cap read off a state the bot sees a step EARLIER than the engine's gate
date: 2026-09-12
scope: engine/game/strokes.ts, engine/sim/bot.ts
concepts: [flight, bot, tuning, air, tricks, simulation]
---

THE PUMP's dead band exists because the bot leans back in the air to level;
any second control read off an input the bot also uses in the air needs the
same treatment, and THE WHIP (the bars thrown over) needed it on `steer`.

Two things cost measurements to find, and neither is obvious:

**Cap on the LAUNCH, not on the engine's own gate.** `strokes.ts` spends a
stroke when the hull is `flying` — off the water going up, past
`flight.minAir`. Writing the bot's cap with the same `airTime >= minAir`
clause looks correct and is not: the bot decides on the state as it stands
BEFORE the step and the engine reads that gate AFTER, so exactly one step
passes on which the bot has not capped and the engine already counts the
hull as flying. One step is a WHOLE throw, because the stroke's mark starts
each flight at zero. It cost seven accidental barrel rolls over sixteen
`make sim` runs, and it reads as a bot rolling itself over for no reason.
`c.airborne && c.launchVy >= TUNING.flight.launchVy` has no lag.

**Do not cap through the chop.** Capping every airborne step took the bars
off the levelling loop for every crest the hull skips off, and the stand-up
— the craft whose rider commands the most — missed two gates of six on the
synthetic shore where it had missed none.

Verify with a probe that counts `trick` events over `make sim`'s seeds: the
target is ZERO accidental rotations, and it is a one-line answer where the
report's columns are noise.
