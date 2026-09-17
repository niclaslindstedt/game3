---
title: A second way of measuring one event is DERIVED from the first at one tie point, never authored as a rate beside it
date: 2026-09-17
scope: engine/game/tricks.ts, engine/game/defs/tricks.ts
concepts: [tuning, scoring, tricks, balance, state]
---

Paying a jump for its LENGTH as well as its air time is two curves over one
event, and the obvious shape — a `lengthRate` in `TUNING.tricks` beside
`airRate` — is the trap. Two authored rates are a tie nobody states, and the
day one moves the halves quietly stop weighing the same.

Author ONE number instead, and make it the tie point in disguise.
`tricks.lengthKnee` (17.5 m) is the air's own `airKnee` expressed on the
other axis, so it IS a speed; `lengthPointsPerMetre` then states the rate
once as `airRate · airKnee / lengthKnee`. Substituting `d = v·t` into the
length integral collapses it to the air's integral exactly, so "the two
halves weigh the same at the reference speed" is arithmetic rather than a
promise, and a test can assert it by integrating both.

Two practical notes:

- **Measure the tie point, do not pick it.** Riding the bot over the four
  campaign TRICKS shores on all four hulls gave 302 counted flights, 4 844 m
  over 278 s = 17.4 m/s, with the shores spanning 16.4–18.0 and the roster
  15.1–19.3 — one figure covers both. It landed the aggregate at 0.93 and the
  MEDIAN flight at 1.04, which is what "roughly equal" actually means.
- **Pay it on the same counting line as the first half**, gated on the same
  `flight.airCounts`. A second threshold in metres would be a second claim
  about the same half-second.

The per-step bookkeeping is a `paidLength` on the owning state (`TrickState`),
assigned from the craft's reading every step of the regime: the increment is
what gets paid, and because a flight opens at `airLength` 0 it can never
carry the previous flight's metres.
