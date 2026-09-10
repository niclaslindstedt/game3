---
title: Tune a drawn line by the SHAPE that comes out of it, not by the knobs going in — a river at sinuosity 1.07 is a canal, whatever the meander is set to
date: 2026-09-10
scope: engine/mapgen/river.ts
concepts: [river, measurement, bands, route]
---

R26's river is a walk with a meander noise and a pull toward the way inland
lies. Tuned by eye off `make level` it looked plausible; measured, its
SINUOSITY — walked length over the straight line it makes good — came out
at 1.07 against a real lowland river's 1.3–2. The meander was not too weak;
the inland PULL was too strong, and a walk turned toward one heading every
step cannot bend far off it. Pull 0.34 → 0.22 and swing 0.55–1 → 0.7–1.15
put the median at 1.7.

Two things worth keeping from that:

- The number is now a CHECK (`river.sinuosity`, a band, in R26's analysis),
  which is the only reason the next tuning pass cannot flatten it back
  without noticing.
- A band that never binds is a number doing nothing: `river.length` was
  drawn per level and had no effect at all, because the walk always stopped
  on the inland target first. Every river came out at exactly 1152 m of
  walking, which is the tell — a drawn band whose output has no spread is
  not being read. The draw moved to the target that does bind
  (`river.inland`), and `length` became the cap the walk gives up at.
