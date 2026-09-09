---
title: A chase camera looks ALONG the water, so anything drawn under the surface only reads within about a hull-length of the craft or when it breaks the surface
date: 2026-09-09
scope: pwa/src/game/fauna.ts, pwa/src/game/water-mesh.ts, pwa/src/game/scenarios.ts
concepts: [fauna, water, transparency, camera, screenshots]
---

The first three attempts at staging the `wildlife` shot all failed the same
way, and the reason is geometry rather than transparency. The chase camera
sits about 5 m up and looks roughly horizontally, so an animal at depth `d`
and horizontal distance `x` appears `atan((5 + d) / (x + 10))` below the
lens — past roughly 25° that is off the bottom of the 1280×720 frame. At
7 m of depth NOTHING is in frame beyond about 25 m out, and the water at
that range is at 80° incidence, where any faithful glancing term makes it
opaque anyway. Standing the craft 26 m off a pod produced a frame with no
animal in it at all and no error to explain why.

Three consequences, all still true:

- Stage a fauna shot at 9–14 m, and AHEAD of the pod facing back — a
  formation trails its leader, so standing behind the leader stands the
  craft on top of the second animal.
- The phone viewport (390×844) frames sea life far better than the desktop
  one; judge the look there and accept the desktop frame clipping the
  bottom of a close animal.
- The reason every species in the catalog holds shallower than the water it
  needs is this, not biology. `depth` and `water` are separate fields for
  that reason.
