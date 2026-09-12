---
title: A bench for a hull going UNDER has three traps that each read as a broken game — assert the ENTRY, measure "under" off the whole hull, and know the hull floats awash at ~0.7 m
date: 2026-09-12
scope: engine/game/craft.ts, engine/game/hull.ts, engine/game/submerged.ts
concepts: [measurement, bench, buoyancy, hull, attitude, air]
---

Three separate wrong answers came out of benching a dive before the bench
was right, and each was convincing:

- **A bench that HOLDS an attitude input through a flight flips the craft in
  the air.** `lean: -1` held from 0.35 s after the lip through a one-second
  hang is `flight.leanTorque` plus the pull, and the hull enters already
  inverted — so the water gets blamed for a somersault the air did. Assert
  the entry pose (`rotate(q, up).y` at the first wet step), never assume it.
- **`hull.submerged` is the DEEPEST probe, so it is not "how far under the
  hull is".** A bow driven a metre in with the transom dry reads 2 hull-depths
  "submerged" while most of the hull is in the air. Ask the question with the
  LEAST-immersed bottom probe times the deck's fill (`submergedShare`) — the
  bottom alone confuses a buried bow, the deck alone confuses a hull floating
  inverted.
- **The hull CANNOT be driven under.** Keel bottoms out near 0.7 m whatever
  the rider asks (throttle, lean forward, lean back, any hold): full-immersion
  buoyancy is 2.4–3.3× weight and the jet only points down by pointing the
  hull down, which lifts the transom clear. Do not read a shallow dive as a
  bug — and do not stage `pitch: -0.9, vy: -8` to force one, which is a 10 g
  entry no ride produces. The repo's own staging is `overRing(..., { pitch:
  -0.35, vy: -3 })`; −0.6/−5 is about the steepest honest case.

Also benched and rejected: submerged added-mass inertia. Physically right and
on `docs/riding.md`'s omissions list, but it bought nothing measurable and
made a craft tossed on its back too slow to settle there to capsize at all —
`assist_test`'s "saves the swim" case catches it.
