---
title: A distance promised against a MEAN line is a distance a noise breaks — cut against the wavy edge station by station, or the band becomes a distribution
date: 2026-09-10
scope: engine/mapgen/basin.ts, engine/mapgen/circuit.ts
concepts: [basin, offshore, circuit, noise, measurement]
---

R29 asks a circuit's lap to stand a drawn `inshore` off the water's edge.
The first cut did it against the MEAN sea line and subtracted the coast
wander's whole amplitude for safety. That guarantees a FLOOR and nothing
else: the edge swings ±45 m, so a lap cut to stand 40 m off the mean stood
anywhere from 40 to 130 m off the real one, and the analysis — which reads
the baked field — failed a third of the seeds against a band the search
thought it had honoured.

The fix is one line of arithmetic and it is the honest one: minimise
`u − wander(v)` over the line's own stations and cut there, so the promise
is made against the coast that actually gets built. `coastWander` is now
shared by the cut and the bake for exactly that reason.

**The tell was the band, not the failures.** A floor kept with slack reads
as a band honoured until something asks for the ceiling too; the moment
R29 grew a two-sided `inshore` the slack showed up as a spread. When a
generator promises a DISTANCE from something a noise displaces, either cut
against the displaced thing or state the rule as the floor it really is.

It also paid for itself twice: without the +amplitude fudge every lap sits
where it was drawn to sit, and the build went from 925 ms and 8 of 12 seeds
to 163 ms and 12 of 12, because most of the rejected attempts had been
levels the search built correctly and the scoreboard then refused.
