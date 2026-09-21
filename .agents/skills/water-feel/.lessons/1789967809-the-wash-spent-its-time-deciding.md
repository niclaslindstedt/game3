---
title: Nine tenths of the wash's cost was DECIDING which sources mattered, not adding waves up — and a hull asks once per probe, so the same walk was repeated two dozen times
date: 2026-09-21
scope: engine/game/wash.ts, engine/game/hull.ts, docs/water.md
concepts: [wash, performance, profiling, determinism, sim]
---

`washAt` was **62% of the whole simulation** on a twelve-craft race, and the
instinct — that a sum of a hundred ring packets with a cosine each is what
costs — was wrong by an order of magnitude. Measured by setting the
amplitude floor absurdly high so no source is ever paid for in full, and
then by short-circuiting the trail loop entirely:

| | µs a tick |
| --- | --- |
| as it stood | 1915 |
| the walk alone, nothing evaluated | 1799 |
| no wash at all | 562 |

So the wash cost 1353 µs, of which the whole of the wave arithmetic was
**116 µs**. The other 1237 was deciding. A sample walked 434 slots to find
the 100 worth a cosine — and a hull asks for the wash **once per buoyancy
probe**, two dozen of them inside its own footprint at one instant, so that
walk was done two dozen times over for one hull standing in one place.

**Gathering the short list once for a patch a hull wide is a fifth off the
whole simulation, exactly.** The list is a SUPERSET — every box grown by the
patch's half-width — walked in the trail's own chunk-and-slot order, and
every sample still runs the same per-source tests on it. So the terms are
added in the same order and the run replays to the bit: `determinism_test`,
`simulation_test`'s digests and a full `make sim` all come back byte for
byte, which is what makes this an optimisation rather than a retune.
Invalidate on `lay` and `drop` as well as on `t` — a hull lays into the same
instant it reads from.

**Two things that looked like the answer and were not.** Tightening the
chunk from 16 slots to 8 walks 14% fewer slots and buys about 1% of time —
granularity was never the problem, repetition was. And raising the amplitude
floor from 0.5 mm to 2 mm drops the sources paid in full by 37% for 1.7 mm
rms error against a sea with 1.4 m of relief — a fair trade on its own terms
and still only worth ~5%, because it cuts the sixteenth, not the fifteen
sixteenths.

**Measure the split before optimising a sampler.** Both probes above are two
lines each (floor to infinity; `continue` at the top of the trail loop), and
between them they said which half of the function to work on. The timer in a
shared container swings ±20% run to run, so pick constants off a
deterministic count — slots walked a tick — and use the clock only to
confirm the direction.

**AND DO NOT CARRY A LOCALITY WIN'S RATIO OUT OF THE CONTAINER.** The
interleaved pairs here said a fifth off the tick, consistently and with no
overlap between the two sets. On the machine that raised the problem it was
**7%** — `sim` 2.49 → 2.31 ms. The direction transferred and the exactness
transferred; the magnitude did not, because what this change removes is
REDUNDANT MEMORY TRAFFIC, and a contended, bandwidth-starved shared runner
punishes that several times harder than a desktop core with a real cache
does. Nothing about the count was wrong — 115k slots a tick became 60k — it
is the price of a slot that differs. So for a change that removes work of
this KIND, quote the count as the result and the local clock only as a sign,
and say out loud that the ratio is the container's rather than the
product's. Measured directly: this one over-stated it by about three.
