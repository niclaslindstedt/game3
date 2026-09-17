---
title: A roster-wide mass change lands on every authored guard already sitting at its limit — budget for three test files, not one
date: 2026-09-17
scope: engine/game/defs/craft.ts, tests/craft_test.ts, tests/hull_contact_test.ts, tests/simulation_test.ts
concepts: [catalog, mass, inertia, tuning, tests]
---

Taking `riderMass` from 78–85 to 70 across the four craft is a two-character
edit per row and it broke three unrelated suites, none of them a physics bug:

- `craft_test`'s class-band ratio for the otter went 1.2375 → 1.2524 against
  a bound of 1.25. The rider is the ONLY off-axis term in `inertia()`, so a
  lighter rider takes about a percent of the pitch inertia out and the fast
  class — which is damping-limited rather than acceleration-limited — pays
  1.6% where the slow class pays 0.4%.
- `hull_contact_test`'s spin ceiling went 4.00 → 4.20 rad/s against a bound
  of 4. Less mass and ~4% less ROLL inertia means the same contact impulse
  buys a livelier hull.
- `simulation_test`'s bot cases re-rolled: the marlin, the fastest hull and
  the one already arriving at the ramp with the most pace, now sails past
  the ring on four seeds in six, while the otter got BETTER. The bot does
  not modulate the throttle into a lip, so a lighter roster overshoots it.

The pattern is that a guard authored at a round number tends to be sitting
within a percent of the behaviour it guards, and total mass is an input to
almost everything. So: measure the guard BOTH WAYS before touching it (flip
the constant in the foreground, run the one test, flip back) — the number
that matters is the delta, not the failure — and then follow the file's own
convention. `craft_test` says in as many words that it "records it rather
than widening `SOFTER` until it disappears", and it already carries two such
records; adding a third with the measurement in it is right, and quietly
widening the shared bound is not.

Also worth knowing: `cog.y` is the COMBINED hull-plus-rider centre of
gravity, so gravity makes no net moment about it and changing `riderMass`
alone stays self-consistent. Do NOT try to re-derive `cog.y` from a fixed
hull CoG — the dart's row implies a hull centre of gravity 0.19 m BELOW its
keel, so that reading does not hold across the catalog.
