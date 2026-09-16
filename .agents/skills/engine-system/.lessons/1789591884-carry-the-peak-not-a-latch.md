---
title: An element won by going OUT and coming BACK carries the excursion's PEAK, never an armed latch — a latch pays the failure as the trick
date: 2026-09-16
scope: engine/game/tricks.ts
concepts: [tricks, scoring, state]
---

The laydown (the hull heeled past 45° and brought back level) was first
written as a latch: armed when the roll crossed `laydownAngle`, cleared past
`laydownOver`, spent when the roll came back inside `laydownLevel`. It paid
out on a hull thrown onto its BEAM ENDS, because the whole way back up from
120° passes through the 45–80° band and re-arms the latch on the way.

Carry the peak of the excursion instead (`TrickState.heeled`, zeroed the
moment the hull is level) and judge it ONCE, when it is level: the trick is
won only if the peak fell inside the band at BOTH ends. One number, and it
says exactly the right thing. The same shape applies to any out-and-back
element — a stand-up held and recovered, a nose-dive ridden out.

The rule is only testable because a bounded band can be probed from both
sides: `placeRun({ roll })` at `laydownAngle ± 0.15` and at
`laydownOver + 0.2` are three cases the latch version passed two of.
