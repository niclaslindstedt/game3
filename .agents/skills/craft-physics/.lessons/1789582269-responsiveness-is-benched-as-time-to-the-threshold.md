---
title: "It feels mushy" is benched as TIME TO THE THRESHOLD WHERE THE FORCE CHANGES CHARACTER — not as a force, and not as the input reaching 1
date: 2026-09-16
scope: engine/game/propulsion.ts, engine/game/craft.ts, pwa/src/game/input-model.ts, docs/riding.md
concepts: [bucket, reverse, brake, measurement, bench, input, game-feel, docs]
---

A complaint that a control is slow has no force plot that shows it. The
reverse gate swung linearly at `spec.bucket.deploy` and every braking figure
in `docs/riding.md` was fine — but the skiff reached `bucketNeutral`, the
share at which the jet stops pushing it FORWARD, 0.300 s into a 0.45 s
swing, so a third of a second on the lever bought nothing at all. The number
that finds this is SECONDS FROM THE ASK TO THE ACTUATOR'S OWN THRESHOLD, and
the threshold is wherever the force changes character — a sign change, a
term switching on — never the input reaching its stop. Print it per craft
before touching a rate.

Two things this pass adds to the lessons it re-learned:

- **The app-ramp pairing (`…-a-gate-on-input-shape-has-three-halves`) applies
  to the BRAKE too, and its RELEASE half is load-bearing.** `sampleInput`
  zeroes the throttle while `reverse > 0`, so a slow decay leaves a hole
  where the gate is already out and the pump has been told to idle. Quicken
  both halves, and hold them with a test that reads the engine's own
  constant.
- **Re-run BOTH sides of a published table on YOUR bench.** `docs/riding.md`
  quotes braked figures whose exact staging is not recorded, and they could
  not be reproduced to the digit (its "never" turned out to mean "not inside
  the four seconds beside it"). Diffing new numbers against unreproducible
  old ones invents a delta; running the baseline in a `git worktree add
  <dir> HEAD` beside the change gives before and after from one bench, and
  the columns the change should NOT move come back identical, which is the
  proof.

The scoreboard is the metres-to-90° bench beside a SHORT JAB on the real
keyboard path. A jab turns LESS than pure throttle over 1.5 s and still
places the craft: the brake's win is over a whole 90°, not a short window,
and claiming otherwise in the player docs is the easy overclaim.
