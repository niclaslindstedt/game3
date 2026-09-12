---
title: A system that only READS the craft goes in its own stepper called from `step.ts`, not as a branch inside `craft.ts`
date: 2026-09-12
scope: engine/game/step.ts, engine/game/tricks.ts
concepts: [state, events, step-order, scoring]
---

The trick score needed three things the craft already publishes — `airborne`,
`airTime` and the body pitch rate — plus this step's `land`, `dive` and
`capsize`. Every one of them is on the state or on the event list by the time
`stepCraft` returns, so the whole system is a `stepTricks(state, events)` in
its own module, called from `step.ts` between `noteAirRecord` and
`stepCourse`. `craft.ts` (695 lines, cap 1000) did not grow by a line and
nothing about the physics moved: `make sim` came back with every digest,
time and gate count identical, which is the proof that a read-only system
landed read-only.

Two things about the ordering are load-bearing:

- Run it AFTER `stepCraft`, because the craft's own edge detection is what
  turns a flight into `land` — on the landing step `craft.airborne` is
  already false, so a stepper that ran first would see neither the flight
  nor the event.
- `step.ts`'s reset branch RETURNS before `stepCraft` is ever called. A
  system with state that a reset should clear needs its own call in that
  branch (`resetTricks`), or the reset silently does nothing to it.

And the state itself splits the way `Progress` does: the SHAPE in `state.ts`
beside the other run state, the `freshX` and the stepper in the owning
module. That avoids a type cycle and matches what `course.ts` already does.
