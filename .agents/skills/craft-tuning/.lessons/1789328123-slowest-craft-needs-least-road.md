---
title: The SLOWEST craft reaches its practical top speed in the SHORTEST distance — calibrate a run-up on the marlin, never on the dart
date: 2026-09-13
scope: engine/game/defs/craft.ts, engine/game/limits.ts
concepts: [catalog, acceleration, top-speed, measurement, roster]
---

"Calibrate for the slowest craft" is the intuition, and on this roster it is
backwards. Measured with a scripted full-throttle run from rest to 95% of each
hull's own top speed:

| craft | top speed | flat water | in a 6 m/s sea |
| --- | --- | --- | --- |
| dart | 78 km/h (slowest) | 69 m | 76 m |
| skiff | 95 km/h | 112 m | 159 m |
| otter | 91 km/h | 128 m | 167 m |
| marlin | 108 km/h (fastest) | 154 m | 288 m |

A low top speed is REACHED sooner, so the dart needs the least water and the
marlin over twice as much. Anything sized "so every craft gets up to speed"
(R35's ramp stride, a run-up, a straight before a jump) is the MARLIN's number;
the dart's is a third of it and leaves everybody else short.

`runUpTo(spec, share)` in `engine/game/limits.ts` is the closed form —
`x = (v²/2a₀)·ln(1/(1−share²))` with `a₀` read back out of the spec's own
`accel0to50` — and it lands within a tenth of the scripted run on flat water.
In a real sea it under-reads by up to half again, because a hull climbing a
head sea spends thrust on the wave; that is a deliberate cost where the
alternative is half the ramps on the shore, but say so rather than quoting the
flat-water figure as what the rider gets.
