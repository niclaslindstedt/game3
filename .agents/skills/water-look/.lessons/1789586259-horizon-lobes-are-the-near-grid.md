---
title: The two dark lobes at the horizon on flat water are the NEAR grid's square rim, not the far grid, the ring, the window or the ripples — five causes already ruled out
date: 2026-09-16
scope: pwa/src/game/water-mesh.ts, pwa/src/game/water-grid.ts
concepts: [grid, horizon, fog, video-rows, artifact]
---

UNFIXED as of this date; this is the triage, so the next session does not
repeat it.

**The symptom.** On near-flat water from a low chase seat, two dark,
finely-stippled masses sit at the horizon to left and right and swing across
the view as the rider turns. Reproduced at
`--scene offshore --seed 47 --mode free --day 0 --waves 1`.

**What it is.** The near water grid is a SQUARE of half-width `waterReach`,
aligned to the WORLD axes and centred on the craft. Its four corners stand
√2 further out than its edges, at fixed world bearings — which is exactly why
the lobes are symmetric and why they rotate with heading rather than with the
hull. They are that rim seen at a grazing angle.

**Ruled out, each by one build and one shot:**

| Suspect | Test | Result |
| --- | --- | --- |
| the far grid | `far.add(horizon)` — farMesh never added | unchanged |
| the horizon ring's hole | `RingGeometry(reach * SQRT2, …)` | unchanged |
| the see-through window | `--see 0` | unchanged |
| the ripple reach | medium's `rippleFade` set to low's | unchanged |
| anisotropy | medium's `anisotropy` 8 → 2 | unchanged |
| the DISTANCE row | `--distance low` (half the reach) | unchanged |

Only the WATER row moves it: gone at LOW, plain at MEDIUM, larger at HIGH —
and NO single WATER lever reproduces that on its own (medium given low's
`cell`, `core` and `rings` still shows them). So it is a threshold several
levers each nudge, which is what a rim seam at the edge of the fog looks
like. Start from how the rim's last ring hands over to the far surface, and
judge it from a LOW seat: at `--camera heli` it is invisible.
