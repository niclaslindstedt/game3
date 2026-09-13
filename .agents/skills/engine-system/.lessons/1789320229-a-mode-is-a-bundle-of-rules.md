---
title: A MODE is a bundle of rules on the state, and the default with no mode is today's behaviour — so every digest stays put
date: 2026-09-13
scope: engine/game/defs/modes.ts, engine/game/step.ts, engine/game/run.ts, engine/game/rivals.ts
concepts: [state, modes, determinism, rivals, step-order]
---

Three modes (a race, a timed tricks run, a time trial) landed without moving
a single sim digest, and the shape that made that possible is worth keeping:
the engine never learns a mode's NAME. `GameState.rules` is a plain record
of switches — the course counts, the tricks count, how many rivals, how
long the lights hold, whether a buzzer ends the run — a mode is a named
bundle of them (`MODE_RULES`), and `createGame` with no `mode` deals
`OPEN_RULES`: everything on, no lights, nobody else. That is exactly what
the sim, the labs and every existing test already rode, so they did not
notice. Any rule can also be overridden by hand (`rules: { countdown: 0 }`),
which is how a test rides a race without three seconds of lights in front
of every case.

Two structural moves followed from it:

- ONE rider's step became its own module (`run.ts`'s `stepRun`: the reset
  branch, the craft, the record, the score, the clock, the course, the
  buzzer) so a RIVAL could be a whole `GameState` over the same world —
  sharing the level, the sea, the wind, the rules and the RNG by reference —
  stepped by the same function and ridden by the sim's own bot. Eleven
  rivals cost eleven hulls of physics (about 7 % of a sim second in Node)
  and no new rule anywhere.
- The clock moved OUT of `stepCourse` into `stepRun`, because a run with no
  course still has one to run down. Nothing noticed.

And one physical: a jet idles forward at about a metre a second, so a grid
left to the physics under the lights has drifted apart before GO. The
field's horizontal velocity is pinned to zero while the phase is
`countdown`; the hull still heaves on the wave.
