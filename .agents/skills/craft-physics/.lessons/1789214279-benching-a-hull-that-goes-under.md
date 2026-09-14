---
title: A following-sea bench must separate a buried bow from a swallowed hull — and correct pitch, not heave
date: 2026-09-12
scope: engine/game/assist.ts, engine/game/craft.ts, engine/game/hull.ts, engine/game/submerged.ts
concepts: [measurement, bench, buoyancy, hull, attitude, air, assist, game-feel]
---

Three traps make a dive bench report the wrong thing:

- **A bench that HOLDS an attitude input through a flight flips the craft in
  the air.** `lean: -1` held through a one-second hang is
  `flight.leanTorque` plus the pull, so the water gets blamed for a
  somersault the air did. Assert the entry pose at the first wet step.
- **`HullResult.submerged` is the DEEPEST probe.** A bow a metre under with
  its transom dry looks like a submerged craft by that reading. The
  whole-hull question is `submergedShare(bottomUnder, deckFill)`, published
  as `CraftState.submerged`: the least-immersed bottom probe rules out a
  buried bow, and deck fill rules out an inverted hull floating on its back.
- **A `dive` event is not every time the deck goes under.** It is armed by an
  airborne landing. A following crest can overtake a continuously wet hull,
  swallow it for more than a second, and emit no event, so measure depth,
  whole-hull share, duration, and lost speed directly.

For passive following-sea compensation, correct ATTITUDE rather than adding
vertical lift. In the 100-seed × four-craft following corpus, pitch-only
correction reduced sustained whole-hull submergence from 54/400 rides to
0/400; an upward pulse changed the heave timing and left 13/96 known bad
rides under. Gate the torque on wave travel, forward speed, and bow-first
immersion, and hold the null cases for head seas, beam seas, rest, and level
draft. Yield it to full forward lean: the hand stops an accidental stuffing,
not a dive the rider deliberately commands.

Also benched and rejected: submerged added-mass inertia. Physically right and
on `docs/riding.md`'s omissions list, it bought nothing measurable and made a
craft tossed on its back too slow to settle there to capsize at all —
`assist_test`'s "saves the swim" case catches it.
