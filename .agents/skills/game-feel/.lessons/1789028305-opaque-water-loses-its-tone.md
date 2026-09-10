---
title: Most of the open sea's tone is the dark bed showing through it — an opacity switch that only sets alpha to 1 hands back a pale, milky sea
date: 2026-09-10
scope: pwa/src/game/water-mesh.ts, pwa/src/game/water-shader.ts
concepts: [water, water-mesh, shader, see-through, colour]
---

The near grid's alpha is `mix(aWindow, 1, F)` with `aWindow` between
`CLEAR_WINDOW` (0.22) and `DEEP_WINDOW` (0.62), so at ordinary chase angles
the surface is showing only a third to a half of its own colour and the rest
is the sea bed behind it. That blend is doing most of the darkening: closing
the window by writing `aWindow = 1` and `material.transparent = false` gives a
sea that is not merely solid but visibly brighter and bluer — a different day,
not a cheaper picture, and the foam stops standing out against it because foam
was always solid.

The correction that works is a dim on the vertex colour by exactly what the
blend was worth, `w + (1 − w)·CLOSED_BED`, using the same `w` the window
itself is written from. Riding `w` rather than the DEEP ramp is what keeps it
honest in the shallows: there `w` is smallest but the bed is BRIGHT sand, and
seeing it through the water made the water paler rather than darker, so the
correction has to be gentlest exactly where a depth-driven one would be
strongest. A mix toward the deep colour is the wrong shape — deep water is
already at that colour and the blend was taking it PAST; what is missing is
darkness, not blueness.

`CLOSED_BED` is eye-set (0.5) against `--scene cruise --see 0` beside
`--see 1`, and deliberately short of matching. There is no one right number:
the bed is a lit surface with its own materials at every depth.
