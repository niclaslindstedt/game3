---
title: A gameplay rule that has to MEASURE the sea gets its own pure (place, clock) module, not a private helper in the system that asked
date: 2026-09-16
scope: engine/game/wave-ride.ts, engine/game/tricks.ts
concepts: [state, determinism, water, tricks, scoring]
---

Scoring "the rider held the top of a wave" needed a reading the sea does not
publish: how big the wave under the hull is and how far up it he sits. The
sea is four bands of a hundred-odd Gerstner terms, so no component IS the
wave — the honest measure is the zero-crossing one `make surf` uses, the
surface swept across one peak period at the rider's own plan point
(`seaSummary` for the period, `heightAt` for the samples).

Put it in `engine/game/wave-ride.ts` rather than inside `tricks.ts`, for the
`faunaPose` / `surfaceAt` reason: it is a pure function of (place, clock),
so it stores nothing, replays identically, and the score, a readout and the
suite all read ONE statement of the rule. Split the rule from the
measurement too — `underWay(craft)` is the half that needs no sea read, and
calling it first keeps the nine-sample sweep off every step where the hull
is slow.

Numbers that came out of the measurement, worth not re-deriving: nine
samples converge (0.60 m crest-to-trough against 0.62 m at thirty-three);
the sweep costs about 12% of a physics step when it runs; and reading it
each step added nothing to `GameState` beyond the ride's own bookkeeping and
moved NO simulation digest, because it consumes no RNG.
