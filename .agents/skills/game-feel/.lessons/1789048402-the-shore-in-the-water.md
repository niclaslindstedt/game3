---
title: The shore in the water is a second pass from the lens's mirror image, with the sky left OUT of it — and the mirrored lens is reflected through the water plane, never through the origin
date: 2026-09-10
scope: pwa/src/game/reflection.ts, pwa/src/game/water-shader.ts, pwa/src/game/renderer.ts
concepts: [water, reflection, mirror, shore, flora, render-target]
---

What the water mirrors besides the sky (the coast, its cover, the rocks, the
gates, the craft and rider) is geometry, so it is drawn again from under the
water into a small render target (`reflection.ts`: the real lens reflected
in y = 0, the same projection, Lengyel's oblique near plane so nothing under
the surface is drawn — no clipping planes, so every material works
unchanged) and the shader reads it where a flat mirror would, wobbled by the
face's tilt and a mip level or two down.

Rules found by looking:

- **Reflect the POSITION through the plane, not through the origin.** The
  first pass reflected then negated (half of the Reflector's dance, without
  the other half) and the mirrored lens stood at (−x, y, −z): a texture of
  nothing, and no visible error anywhere else. If the shore is missing from
  the water, check where the virtual lens stands before anything else.
- **Leave the dome and the rain out of the pass, and clear to alpha 0.** The
  sky is reflected analytically and BLURRED (`skyAlong`); a dome drawn sharp
  into the mirror puts its cloud edges back on the crests. Alpha is what
  tells the shader where the mirror has a picture and where the sky shows.
- **Cull the cover against the mirrored frustum too.** A stand of pines
  behind the rider is off screen and in the water at once; `flora.update`
  takes the second frustum.
- The pass's draw calls are added to the frame's bill, so `make profile`
  reads honestly; it is the DETAIL row's and OFF is no pass at all.
