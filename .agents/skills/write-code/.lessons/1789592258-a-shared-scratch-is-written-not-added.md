---
title: Every writer of a shared scratch result writes ALL its fields — a helper that "adds to out" doubles whatever the previous helper left there
date: 2026-09-16
scope: engine/game/craft.ts, engine/game/submerged.ts, engine/game/flight.ts, engine/game/assist.ts
concepts: [scratch, allocation, forces, double-count, api]
---

`stepCraft` allocates nothing per step: every force module writes into ONE
`AeroResult` scratch (`aero`) and the caller adds `aero.tx` etc. to its
accumulators after each call. That contract only works if every writer
ZEROES the six fields first. A damping helper written to "add its torque
to `out`" — natural for a term that is usually summed — was called right
after the submerged control had written the same scratch, so the caller
added the control's torque twice: once as itself, once inside the damping's
"addition". Nothing failed; a test that reused a scratch between two calls
caught it by expecting zero and finding the earlier call's number.

Rule: a function taking an `out` scratch WRITES it, all fields, every call,
even when it has nothing to say (`if (share <= 0) return` comes AFTER the
zeroing, not before). If a term genuinely wants to be summed, sum it in the
caller, which is the one place that knows what else is in the scratch.
