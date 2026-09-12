---
title: Ease a state countdown by taking the RATIO of the curve across the step — and guard the divisor, because the last step's float crumb makes it zero and every angle NaN
date: 2026-09-12
scope: engine/game/craft.ts
concepts: [capsize, righting, tuning, determinism, easing]
---

The righting branch of `stepCraft` scales the hull's pitch and roll toward
zero without storing where they started: each step multiplies the CURRENT
euler angles by a share, and the shares telescope. To ease that motion
(hang, come over fast, settle) rather than run it at a constant rate, keep
the same shape — `share = standing(left) / standing(before)`, where
`standing` is the share of the angle still up at a point in the countdown
(smoothstep's complement). No new `CraftState` field, and the product
still telescopes to exactly zero on the last step.

**It needs a divisor guard.** `righting -= dt` at 120 Hz does not land on
0 — it lands on a crumb like 1e-16, and `standing(1e-16)` rounds to 0, so
the next step divides 0/0 and the craft's quaternion is NaN from there on.
The symptom is three suites failing at once with `expected NaN to be less
than 0.15` (`buoyancy_test`, `scenarios_test`), which reads as a physics
blow-up rather than a one-line arithmetic fault. Take all that is left
when the divisor is zero: `was > 0 ? standing(left) / was : 0`.

Lengthening `capsize.righting` at the same time moves `make sim` digests
on any seed whose run capsizes (38's marlin and otter here) and nothing
else — worth saying in the PR, because it looks like a determinism
regression.
