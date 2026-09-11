---
title: A passage pitched over "a point of the course" is a passage nobody sees — pitch it over where a rider at run pace WILL BE when it arrives
date: 2026-09-11
scope: pwa/src/game/bird-plan.ts, pwa/src/game/bird-defs.ts
concepts: [birds, crossings, migration, placement, screenshots, sizes]
---

The first cut pitched every skein over a random point of the racing line.
On a two-kilometre coast that put most of them 600–1200 m from the rider,
which at a goose's 1.6 m span is two pixels against a bright sky — the
probe (`scripts` scratch: list every bird within 500 m of the cruise
camera with `px ≈ 1280 / (2 · d · tan 30°) · span`) said so before any
screenshot could. A crossing is a designed event, not dealt scenery: it is
now pitched over `pointAlong(path, cum, RUN_PACE · (at + LEAD / speed))`,
the point a rider at the bot's pace has reached by the time the skein gets
there, ± a spread, so the crane vee on seed 1 is 96 m off at t = 0 (25 px a
bird) instead of 590.

The same arithmetic is the honest size check for every bird: real spans,
real ranges, and a gull at 150 m is 12 px. What makes the sky read alive is
therefore RANGE, never scale — flocks whose LOOP (not only whose roost) is
within 150 m of the line, rafts within 240 m, altitudes in the tens of
metres. Do not scale a bird up; bring it nearer.

Two more from the same session: the flush a raft answers a hull with has
to be detected on the engine's STEP (`observe`, the wake's door), not on
the frame — a scene pre-rolled for a shot never draws a frame while the
craft rides through the raft, so a frame-side test photographs birds still
sitting under the bow; and changing any rejection rule in the placer shifts
the seed's whole RNG stream, so "the raft moved" after an unrelated edit is
the expected thing, not a bug.
