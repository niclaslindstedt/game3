---
title: `planing` is a proxy for "is there a bottom to act on" and it is blind to both direction and attitude — a term scaled by it fails astern AND under the brake
date: 2026-09-10
scope: engine/game/hull.ts, engine/game/craft.ts
concepts: [drag, planing, reverse, hump, carve, brake]
---

`c.planing` and the hump fade are computed from `c.speed`, which is `|v|`,
and from the lift's share of the weight. Anything scaled by them inherits
both blindnesses, and both have shipped as bugs:

- **Direction.** A craft going ASTERN under its bucket at 6 m/s has C_v past
  `planing.fadeHigh`, so a residuary form drag scaled by `1 − planingShare`
  is multiplied by ZERO while nothing is planing at all (`canPlane` needs
  `uFwd > 0`). The fix is to branch on the probe's own `uFwd` sign: astern
  uses `asternCd` with no fade.
- **Attitude.** The carve was scaled by `c.planing` because a banked bottom
  needs a bottom. Dropping the reverse gate takes that reading from 0.72 to
  0.26 on the skiff — and a braked hull has MORE in the water, not less: the
  stern squats, the bow buries and the forefoot and front half of the keel
  wet. So the gate puts its own floor under the reading (`hull.brakeBite`).

The rule to carry: `planing` answers "how much of the weight is on the
planing surface", not "how much hull is in the sea". Before scaling a term by
it, say out loud which of the two the term needs — and if the answer is the
second, the term owes a branch or a floor for every attitude that wets hull
the planing surface does not.
