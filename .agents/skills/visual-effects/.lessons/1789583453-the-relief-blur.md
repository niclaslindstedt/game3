---
title: THE RELIEF BLUR (~2 m) decides every mark's shape twice — one feature narrower than it never moves water, and two of opposite sign inside it CANCEL; stretch the pattern, never deepen it
date: 2026-09-11
scope: pwa/src/game/wake-profile.ts, pwa/src/game/wake.ts, pwa/src/game/water-shader.ts
concepts: [wake, relief, blur, splash, stern-wave, mip, grid]
---

The water shader reads the map's crest and hollow channels `WAKE_RELIEF_LOD`
levels down (three: about a two-metre blur) and the near grid's cell is a
metre and a half. Two failures fall out of that, and they look identical
from the camera — "the map holds it and the sea is flat".

**One feature too narrow.** The splash's ring wave at 1.6 m wide was in the
map (painting its channel into the foam proved it) and still moved nothing;
at 3.2 m it does. The same holds for a crater: make it the hull's LENGTH,
not the beam.

**Two features too close.** A hollow and a mound of opposite sign inside one
blur kernel average to nothing. The transom hollow and the convergence mound
were the case: the raw map read −0.20 m and +0.28 m and the BLURRED read,
the only one the water gets, −0.04 m and +0.06 m. Both were correct, both
were big, and the sea did not move. Deepening is the wrong reflex — it
drives the eight-bit channels toward saturation and the blurred result
barely changes, because what is lost is the cancellation and not the
amplitude. STRETCH the pattern until the features clear one another, as one
stated factor with a comment saying it is the renderer's grid showing
through the physics (`MOUND_STRETCH`, 2.7).

**The diagnostic is the SECTION, not the plan.** In plan the crest and
hollow channels were two strong washes and looked right. Plot the blurred
relief in metres with the raw map faint under it (`make wake --profile`);
painting a channel into the foam only answers the cheaper question, whether
the mark is in the map at all. A mark that is only ever half a blur wide
needs its foam or its churn to carry it, because its relief never will.

