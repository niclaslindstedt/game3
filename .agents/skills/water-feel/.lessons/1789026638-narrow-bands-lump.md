---
title: A spectral band with few components can deal one draw most of the sea, because the cos² directional weight VANISHES at the edge of the spread
date: 2026-09-10
scope: engine/game/water.ts, engine/game/defs/tuning.ts
concepts: [spectrum, steepness, tuning]
---

`layBand` draws each component's heading uniformly across `sea.spread` and
then weights its energy by `cos²((s/spread)·π/2)`, which is zero at the band's
edge. With eight components that lumpiness is invisible; with three it is not —
one unlucky draw takes the energy of its neighbours, and since the amplitudes
are normalised to Hs the survivor gets it all.

Found on the LOCAL band (the wind chop, five components over 0.8–1.8 f_p):
at three components the steepest component reached `a·k` 0.43 on two seeds of
twelve — Michell breaks at 0.44 — so the shortest wave in a river sat on the
point of breaking and the renderer's tilt thresholds would paint it white. At
five the worst is 0.27, in line with the ocean band's own 0.08–0.12.

**The check is one sweep, not one seed**: print `max(amp · k0)` per band over
the seed corpus before believing a band width or a component count. Widening
the band or lengthening the period does not fix this; only more components do.
