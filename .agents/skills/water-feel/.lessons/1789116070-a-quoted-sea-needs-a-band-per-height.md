---
title: A sea QUOTED by its height takes its wavelength from that height, so one band cannot serve two sizes — lay a band per height and walk the field band by band
date: 2026-09-11
scope: engine/game/water.ts, engine/game/ocean.ts
concepts: [spectrum, steepness, feel, performance]
---

`periodForHeight` ties a quoted sea's wavelength to its height through
`steepness`, so a single band laid at the biggest height the model carries and
scaled DOWN by a share gives every smaller sea the big one's wavelength. When
the open band's quote went from 20 m to 1000 m, the sea two kilometres out
kept its 11 m height and got a 13 km wave: `H/λ` fell from 0.038 to 0.006 — an
ocean tilting, not a wave. `seaSummary`'s Tp is right while this is wrong, so
only the lab's steepness column catches it.

The fix is a BAND PER HEIGHT (`SeaBand`, one per rung of
`TUNING.sea.open.ladder`), neighbouring bands handing over on the height by
ENERGY (`f` and `1 − f`), which makes the wavelength walk up with the height.

That multiplies the component count, and the way to pay for it is to make
`surfaceAt` walk `sea.bands` instead of `sea.components` in BOTH passes:
a band whose share is nothing then costs one comparison instead of one per
component. Measured: 61 components band-major is 548 ns/sample against 626 for
21 component-major. Two things make it work — a band's `at` is its own
ascending run through the k-sorted array, so `count` still means "the longest
n"; and a skipped band leaves STALE numbers in `held`, which is fine only
because the second pass asks the same share question before touching one
(clearing the array per sample costs more than it saves).
