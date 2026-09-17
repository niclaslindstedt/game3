---
title: A field the ride writes and the hull reads back (the wash) must be cleared by `placeRun`, or a test that re-places the craft lands on its last placement's rings
date: 2026-09-16
scope: engine/game/place.ts, engine/game/wash.ts
concepts: [state, place-run, determinism, tests, wash]
---

`placeRun` stands a run at a moment and the tests use it to stage four
flights in ONE state, dropping the craft on the same spot each time. A
field the ride writes into the sea — the wash's ring buffer — survived the
placement, so the second drop landed on the first drop's splash rings and
took an extra hop: `flight_test`'s record case counted five landings for
four. Anything stepped and felt back through `surfaceAt` gets a `clear`
called from `placeRun`, and a claim in its own test that a moment stood
forgets it. The same reasoning says a run's sea is not fully pure any more:
`SeaState.washes` is the one part of it the ride writes, and a test that
wants the bare sea splices it out and back.
