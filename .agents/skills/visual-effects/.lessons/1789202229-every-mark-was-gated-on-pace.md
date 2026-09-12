---
title: Every mark the trail carries is gated on PACE, so a craft with the throttle open and no way on leaves a glassy sea — the pump's own blast has to be its own mark
date: 2026-09-12
scope: pwa/src/game/wake-profile.ts, pwa/src/game/wake.ts, pwa/src/game/spray.ts
concepts: [wake, jet, spray, pace, standing-start, hull-mark]
---

The road, the boil and the fan are all things the hull's PASSAGE left, so
every one of them is a function of speed — and at a standstill a hull has
passed over nothing. The result was a full-throttle standing start with a
completely blank sea until about 16 km/h: over a second of the loudest
moment in the game with nothing on the water at all. It survived because no
camera in the game can see the trail in plan (build `make wake` first).

A pump firing at a stop is not doing nothing. The cure is a mark laid off
the craft's STATE rather than sampled into the trail — the pattern the
brake's pool and the capsized hull's boil already use, because it is
attached to the machine and not to the water. Two things make it land:

- **Hand it over on the OTHER mark's constant, not a number beside it.**
  The jet fades out at `SPEED_FULL`, the pace at which the road is fully
  white, read off it directly. Quoted separately, the two drift and a
  version ships with a hole between them.
- **It needs something in the AIR or it reads as a decal.** A map is flat by
  construction. And the airborne half had the keel-birth bug this skill has
  already recorded once: the rooster tail was born at `keelY`, which a
  planing hull skims and a stopped hull floats a fifth of a metre under, so
  at the one moment it mattered it threw nothing that broke the surface.
  Spawn at `max(hullPoint, heightAt(...))`, and scatter the birth along the
  first stretch of the stream — all of it born at one point is a puff
  sitting on the transom rather than flow leaving the nozzle.
