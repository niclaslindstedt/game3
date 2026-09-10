---
title: Every absolute tilt threshold in the water mesh is tuned for a wind sea and paints a monster swell entirely white — hold them against the sea's own characteristic tilt too
date: 2026-09-09
scope: pwa/src/game/water-mesh.ts, engine/game/water.ts
concepts: [renderer, water-mesh, foam, storm]
---

A tilt (`1 − n_y`) of 0.09 is the surface standing at Michell's breaking steepness, so as an absolute foam threshold it is right for a wind sea, whose crests only just reach it. A big quoted swell is steep over its whole face by construction: every vertex passed the band, the sea came out a uniform white snowfield with a jet ski on it, and the Fresnel grazing term finished the job. Hold each band against the SEA'S OWN tilt as well — that of a sinusoid of `hsRef` at its peak wavelength — and take the wider: a gentle sea is unchanged (its own tilt puts the relative band back on the absolute one), a monster sea foams only where it is steep for itself. The same trap is waiting in `WHITECAP_TILT` and in anything else keyed to `hsRef` or to a slope. **Photograph `--scene storm --hs 20` after touching any of it**; the ordinary scenes will not show you this at all.
