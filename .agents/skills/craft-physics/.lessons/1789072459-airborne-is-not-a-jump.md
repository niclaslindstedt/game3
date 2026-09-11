---
title: `c.airborne` is true a fifth of the steps at speed in a head sea, so anything gated on it alone is fitted to the whole ride, not to jumps — gate on `airTime >= flight.minAir` too
date: 2026-09-10
scope: engine/game/flight.ts, engine/game/craft.ts
concepts: [flight, chop, game-feel, air, tuning]
---

The hull is airborne whenever no probe is wet, and over chop at pace that is
constant — skips of a few hundredths of a second, a fifth of the steps. Any
new airborne-only force therefore acts on the RIDE and not on jumps, and if
it is also scheduled against time-to-splashdown it acts at maximum urgency
every time, because a skip's whole life is inside any sane approach window.

`landingAssist` gated on `c.airborne` alone flattened `make ride
SCENARIO=chop` from a pitch range of −14°…33° to −6°…18° — the drumroll of a
head sea turned into a pitch damper permanently fitted to the hull, which is
the one sensation this game is for. Adding `if (airTime < F.minAir) return`
put it back to −9°…18° and left `SCENARIO=launch` all but identical to the
bare physics, while costing the flight bench nothing (real flights are
seconds long).

`TUNING.flight.minAir` (0.2 s) is the repo's existing line between a chop hop
and a jump — the launch event is already read against it — so use that rather
than inventing a second threshold. And read `SCENARIO=chop`'s pitch range
before and after any airborne-gated change: the flight scenarios will look
fine while chop quietly goes mushy.
