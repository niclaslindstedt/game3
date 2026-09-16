---
title: `clipSolids`'s keel points are the hull's own keel probes, rocker and all — a level line through the CoG is half a metre wrong at the bow
date: 2026-09-16
scope: engine/game/collision.ts
concepts: [solids, contact, probes, hull, rocks]
---

The solid contact used to sample three points at a fixed `-spec.cog.y` with
only the plan offsets rotated, which models a hull as a flat plank. It is not:
`TUNING.hull.stationRise` lifts the forefoot 0.42 × the hull depth above the
transom, and the trim lifts it further. Reading the actual keel probes
(`hullProbes(spec)` filtered to `kind === "keel"`) is what lets a bow-up hull
clear a rock its transom would strike, and it is the difference between
"rides over a rock awash" working and not.

Two things to keep when doing it: sift the keel probes ONCE into a `WeakMap`
keyed on the probe array — `filter()` inside a function called 120 times a
second is garbage — and cull the solids against the CoG with the probes' own
plan reach before looping them, or a level's whole rock scatter is walked per
probe per step.

It moves digests: `make sim` on the corpus shifted one craft/seed by 15 s with
gates and misses unchanged, because the bot meets the same rocks at a slightly
different footprint. Expect that and say so in the PR.
