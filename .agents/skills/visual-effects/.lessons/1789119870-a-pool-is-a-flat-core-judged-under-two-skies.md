---
title: A mark laid under the hull off its state wants a FLAT core ring, a foam share under saturation, and a look under a clear sky as well as the scene's — a centre-only cone reads as speckles and a saturated pool under rain at dusk is an invisible grey smudge
date: 2026-09-11
scope: pwa/src/game/wake.ts, pwa/src/game/wake-profile.ts
concepts: [wake, foam, hull-mark, brake, render-target, screenshots, sky]
---

The brake's pool went into the map (the raw-channel diagnostic showed the
yellow ellipse round the hull on the first try) and still read as nothing,
twice, for two different reasons:

- **Geometry.** The capsize boil's fan carries its foam on the centre vertex
  alone and nothing on the rim, so the interpolated share falls off linearly
  and only the middle third clears the lace's threshold. A pool is flat: the
  mark's fan is now centre + a ring at `core` (full strength) + the rim
  (nothing), and `HullMark.core` says where the flat top ends.
- **Saturation and sky.** At a foam share of 0.85 the lace is
  `smoothstep(0.15, 0.5, tile)` — a blanket with no holes — and under the
  brake scene's own sky (rain, dusk) the foam colour is a lavender-grey a
  hair off the water's mirror, so a blanket is a smooth patch the eye reads
  as flat water. At 0.65 the tile's holes show and the pool reads as broken
  water; under `--weather clear --hour 12` it reads as white from the chase
  camera at 1280 px without zooming.

Judge any white on the water under the clear sky AND the scene's: the second
tells you whether the effect survives the worst light, the first whether it
exists at all.
