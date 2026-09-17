---
title: Lay a BAND PER QUOTED HEIGHT, hand neighbouring bands over on the HEIGHT in energy, and draw a new band LAST — one band scaled down is an ocean tilting, shares that sum to one make a calm belt, and an earlier draw re-rolls every sea
date: 2026-09-11
scope: engine/game/water.ts, engine/game/ocean.ts
concepts: [spectrum, steepness, feel, performance, determinism, rng]
---

`periodForHeight` ties a quoted sea's wavelength to its height through
`steepness`, so ONE band laid at the biggest height and scaled DOWN by a
share hands every smaller sea the big one's wavelength: when the open band
went from 20 m to 1000 m, the water two kilometres out kept its 11 m and got
a 13 km wave, H/λ 0.038 → 0.006 — an ocean tilting. `seaSummary`'s Tp reads
right while this is wrong; only the lab's steepness column catches it. So
`SeaBand` is one band per rung of `TUNING.sea.open.ladder`.

**The handover is written on the HEIGHT.** Fading one band's share out and
the next's in leaves a DIP where they cross — they carry different heights,
and shares that sum to one do not make heights that do. Write the target
height (grow it from the coast's `hsRef` to the storm's `open.hs` over the
ramp) and solve the new band's share from what the old one no longer
carries, in energy: `open = √(target² − carried²) / openHs`. Hs is then
monotone by construction.

**The draw order is the digests'.** `createSea` pulls every component off
one seeded stream, so a band laid before an existing one re-rolls every
level's sea. Lay it LAST, then SORT the combined list longest-first (the far
grid and `surfaceAt`'s `count` depend on it) — safe, because a zero-share
band is skipped before the sum, so the non-zero terms keep their order and
a coast's water comes back bit for bit. Ten of sixteen sim digests held on
a change that added eight components to every level.

**Pay for the count band by band.** `surfaceAt` walks `sea.bands` in BOTH
passes, so a band whose share is nothing costs one compare instead of one
per component: 61 components band-major measured 548 ns/sample against 626
for 21 component-major. A band's `at` is its own ascending run through the
k-sorted array, so `count` still means "the longest n"; and a skipped band
leaves STALE numbers in `held`, which is fine only because the second pass
asks the share question again before touching one — clearing per sample
costs more than it saves.
