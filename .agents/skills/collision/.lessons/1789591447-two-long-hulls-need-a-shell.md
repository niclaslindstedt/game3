---
title: A contact between two LONG bodies needs an oriented shell and a manifold — a pair of circles cannot say which end was hit, and its impulse hands out free rotation
date: 2026-09-16
scope: engine/game/hull-contact.ts, engine/game/rivals.ts
concepts: [contact, rivals, bump, yaw, impulse, solver]
---

Hull-against-hull was three keel points with a half-beam circle round each,
resolved as one impulse along the line between the closest pair. Two faults,
and both read to a player as "it spins in an unrealistic way":

- **A circle has no ends.** The normal was whichever pair happened to be
  closest, so it SNAPPED between three very different directions as the hulls
  slid past, each snap a fresh impulse at a metre and a half of lever arm. A
  side, a transom and a bow were the same contact.
- **The effective mass left the rotational term out.** The impulse was sized
  as if the hull could only slide, then spent AGAIN on turning it. That is
  free angular momentum every step of a contact. Measured: peak yaw 18.7 rad/s
  (three turns a second) and a 10° shoulder leaving the two hulls 136° apart
  and 44 m away — scissoring, the exact opposite of rafting up.

The fix is an oriented shell (keel to deck, transom to stem, its plan taper and
keel rocker read off `TUNING.hull.stationTaper` / `.stationRise` so it cannot
drift from the probes) resolved by min-translation through six faces — the
ramp wedge's rule generalised — plus a sequential-impulse solver WITH
`d·((I⁻¹(r×d))×r)` in the denominator. Same sweep: 3.5 rad/s, and a 10°
shoulder ends 1° off parallel, 0.6 m apart, both still at pace.

Two things the point model could not express at all, and the shell gets for
free: **which end** you hit (flank = wall + line-up, transom = pitch, bow =
shouldered outward), and the **height** of the contact — a push below her CoG
lifts her nose, above it buries it, so the striker's own lean decides it.
A FLAT-keeled shell cannot: the rocker is what moves the bow across her
transom's range.
