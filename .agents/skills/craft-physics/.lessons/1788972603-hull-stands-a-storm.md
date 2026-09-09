---
title: The hull rides a twenty-metre sea unchanged — the storm case in waves_test is the ceiling to keep green when touching a force
date: 2026-09-09
scope: engine/game/hull.ts, engine/game/craft.ts
concepts: [storm, slam, dive, bounds]
---

With the sea quoted at Hs 20 m (`createGame({ sea: { hs: 20 } })`, a 60 m bed) the hull at full throttle heaves several metres per swell, pitches inside ±10°, keeps its speed and every reading finite — no force needed retuning, because each one reads the surface RELATIVE to the probe (the orbital velocity, the closing speed) rather than the height. `tests/waves_test.ts`'s storm case holds that; a change to a force that makes it NaN or throws the craft past `hull.maxSpeed` is a force that read the absolute height or velocity somewhere. In the ordinary 1 m sea (`make ride SCENARIO=chop`) the feel is a launch every second or so with air up to 0.8 s and a speed that bleeds from 72 to 55 km/h over eight seconds of head sea — the landings cost, and that is the slam doing its job, not a bug.
