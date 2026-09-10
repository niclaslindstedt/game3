---
title: A sea reads as water when its Fresnel is smooth and its glitter is ONE lobe sized from the wind — Fresnel off the wave's normal, Beckmann over Cox and Munk's variance, and no painted crest tint
date: 2026-09-10
scope: pwa/src/game/water-shader.ts, pwa/src/game/water-mesh.ts
concepts: [water, shader, fresnel, glint, reflection, reference]
---

Three reference photographs (a foggy calm, a clean swell, a storm) all say
the same thing: the sea is a SMOOTH gradient from dark body under the
viewer to sky at the horizon, the waves read as gentle brightness bands on
that gradient, and the sun's glitter is a soft road that fans out with the
wind. Everything sharp in our picture was a departure from that:

- Fresnel read off the per-pixel rippled normal flickers at a grazing
  angle. A rough surface's reflectance is the AVERAGE over its slopes, which
  is smooth — take Schlick off the wave's (vertex) normal and let the ripples
  bend only the reflected ray and the glint.
- Two glint lobes (a pow-900 sparkle plus a pow-60 road) are a sparkle
  field. One Beckmann lobe whose variance is Cox and Munk's measurement for
  the wind (σ² = 0.003 + 0.00512·U) is the road AND the sparkle, and it
  transitions honestly with distance the way Bruneton's ocean paper does
  cheaply: the ripple tile carries a share of the variance where it is
  resolved and the lobe takes it back where the tile has faded. Sizing the
  tile's strength off the same law keeps the two from disagreeing. The gain
  in front of the soft clip is the eye's: 0.35 speckled a midday sea white
  across its whole width, 0.2 reads as glitter.
- A crest tint toward the shallow colour at 0.45 is a blotch that swims;
  a crest is read by what it REFLECTS. Held to 0.18 as a hint.
- The mirror's skyline must FADE (`SkyBuild.skyline`, and the gradient
  averaged over the unresolved slope variance — closed form, `blur`): a
  rough mirror puts half the reflected rays a few degrees under the
  horizon, and a sharp cut is a ruled line across every crest.
- A reflected ray UNDER the skyline lands on the sea, not on the fog: mix
  it toward the body (`MIRROR_UNDER`), or every wave back seen at a grazing
  angle is the fog's colour.
