// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CLOCK — the one place in engine/ (beside the output module's
// timestamps) that reads the wall clock.
//
// The simulation never reads it: a run is its seed and its inputs, and a
// clock's value reaching the state or a draw would make two runs of the same
// seed disagree. What does read it is the code that REPORTS on itself — the
// analysis pass saying how many milliseconds it took. That takes a `Clock` as
// a parameter, defaulting to `wallClock`, and calls `now()` on it; nothing
// calls `Date.now` itself. A test hands in `fixedClock(…)` and gets byte-identical
// reports back, which is what "deterministic" has to mean for a report that
// carries a timing.

/** Milliseconds since the epoch (or any fixed origin — only differences and
 * stamps are ever taken). */
export type Clock = { now(): number };

/** The real clock. The default wherever a clock is taken. */
export const wallClock: Clock = { now: () => Date.now() };

/** A clock that never moves: every `now()` is `at`. For tests and for any
 * report that must come out the same twice. */
export function fixedClock(at = 0): Clock {
  return { now: () => at };
}
