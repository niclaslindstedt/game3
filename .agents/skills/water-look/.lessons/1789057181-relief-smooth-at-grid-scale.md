---
title: Anything that displaces the water grid must be smooth at the GRID's scale in space AND time, or it twitches — blur it to a few cells and give it a rise time
date: 2026-09-10
scope: pwa/src/game/water-shader.ts, pwa/src/game/wake-profile.ts
concepts: [wake, displacement, twitch, mipmap, temporal]
---

The wake's hollow and bow wave read fine in every screenshot and felt
twitchy the moment the game was ridden, and no still could have shown
it. The sea's waves are silk because a crest is several cells long and
takes seconds to pass a vertex; the wake's relief was one to two metres
wide against 1.5 m cells, so one vertex at a time caught it and jumped,
and the sideways push — the gradient of that same sharp field — jumped
with it. Two fixes, both needed: read the relief and its gradient off a
BLURRED mip of the map (`textureLod` at `WAKE_RELIEF_LOD`, three levels
on a quarter-metre texel is a two-metre blur; the foam and the churn keep
the sharp level), and give the relief a rise time in the profile
(`RELIEF_RISE`), because a trough at full depth the instant the transom
passes drops the vertex under it by its whole depth in a few frames. A
foam pattern jogged by `sin(uTime)` reads as jitter too, not as a boil —
keep the foam still in the world and let the churn's normal do the
boiling. A frame-to-frame pixel difference is NOT a measure of any of
this: at 80 km/h the whole frame streams and the twitch is lost in it.
Reason from cell size and pass time instead, then ride it.
