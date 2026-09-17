---
title: `placeRun` must stage EVERY reading of a regime it stages, derived from what the moment already says — a half-staged flight photographs as a jump that went nowhere
date: 2026-09-17
scope: engine/game/place.ts
concepts: [place-run, state, tests, screenshots, scenarios]
---

`PlaceMoment.airTime` exists so a staged apex does not photograph as a hop.
The moment a flight grew a SECOND reading (`CraftState.airLength`, how far
it has carried the hull), staging only the clock made the `apex` scene read
"1.0s AIR" with the new counter hidden entirely — the HUD gates it on
`> 0`, and a staged launch point equal to the craft's own position leaves it
at 0 forever. Nothing failed; the picture was just quietly missing half of
the thing the change added.

The fix is not a new `PlaceMoment` field. Derive the rest of the regime from
what the moment ALREADY says: a hull in the air travels in a straight line
in plan at the way it left with, so `airLength = speed · airTime`, and the
launch point goes BACK up the heading by exactly that
(`launchX = x − sin(heading)·airLength`). The moment is then internally
consistent — `airLength` is the distance from the launch point, as it is in
a flight nobody staged — and every assertion that holds during a real flight
holds for a staged one.

Two things follow. A test that asserted `airLength === 0` right after
`placeRun` is asserting the BUG; assert the invariant
(`airLength ≈ hypot(x − launchX, z − launchZ)`) instead. And when adding a
reading to a regime `place.ts` already stages, grep `place.ts` for the
regime's other fields in the same edit — the compiler will not tell you,
because the field has a value, just the wrong one.
