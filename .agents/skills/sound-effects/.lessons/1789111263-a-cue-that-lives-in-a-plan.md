---
title: A cue raised off something the renderer PLANS (the birds) asks the plan module for the level's one plan, and shares the one memory by a rule stated in the plan — never by reaching into the renderer
date: 2026-09-11
scope: pwa/src/game/audio/bird-bed.ts, pwa/src/game/bird-plan.ts, pwa/src/game/birds.ts
concepts: [cues, determinism, plan, flush, hash2, memory]
---

The birds are the first cue whose SOURCE is not in `GameState`: the flocks
are the renderer's plan (`planBirds(level)`), deterministic off the seed.
The temptation is to hand the audio the renderer's `Birds` object, or to
have `birds.ts` post "a gull cried" — both make the sound depend on a
renderer standing (there is none under a screenshot's frozen frame, and the
DETAIL row can switch the birds off while the ear should still hear them),
and the second makes presentation into an event.

What works: the bed asks the PLAN MODULE for the level's plan
(`birdPlanFor(state.level)`, a `WeakMap` against the level — `planBirds` is
forty milliseconds of hashing the cover for perches, a step behind the
loading card for the renderer and a hitch on the first audible frame if the
bed laid its own), and asks it flock-level questions the plan grew for the
purpose (`flightShare`, so the bed never poses a bird). The one MEMORY the two share — when the
craft last put a raft up — is not shared as state: both keep their own
`Float64Array`, and both decide the moment with `flushAt`, a rule the plan
states once. Two copies of a deterministic decision agree by construction;
one copy handed across a seam is a dependency the imports test would refuse.

The cries themselves are `hash2(slot, channel, flock.scatter)` per
quarter-second slot, never `Math.random` (the tests forbid it in the app's
DOM-free modules as well as the engine) and never `state.rng` (the engine's
stream is the engine's — a draw in the bed would move every digest).
