---
title: Anything the sky SWITCHES rather than re-reads must be stated by `load` for every level, including the level that wants none — and `make sky` cannot catch the leak
date: 2026-09-21
scope: pwa/src/game/environment.ts, pwa/src/tools/sky-preview.ts
concepts: [sky, weather, rain, levels, measurement]
---

One `Environment` outlives every level (`renderer.ts` builds it once and calls
`load` per shore), so anything it holds as STATE rather than re-reading from
the preset each frame can survive a level change. Almost nothing can: the
lights, the fog, the dome and the stars are all re-read every frame off
`skyAt`. The rain is the exception, because it is a pool of geometry switched
on and off.

The trap is writing that switch only where the thing is ON. `update`'s rain
block is guarded by `standingFall > 0` — correct, there is nothing to carry
along under a clear sky — so if `load` does not set the intensity itself, no
call anywhere reaches a dry level, and a level loaded after a wet one keeps
the previous run's streaks: visible, frozen where the old lens left them, and
billed every frame as a transparent `depthWrite: false` sheet across the
picture. `load` must state every level's own answer, and 0 is an answer.

**`make sky` cannot show this.** The sheet walks weathers as rows on ONE
renderer, but it sorts them into the canonical `WEATHERS` order whatever
`--rows=` asks for, so the dry skies are always drawn BEFORE the wet ones and
a dry cell never follows a wet one. Before and after come back byte-identical
(the lab is deterministic to the byte, which makes it a good diff otherwise).
Hold a cross-level leak with a Node test instead: `createEnvironment(new
THREE.Scene())` stands up without a GL context or a DOM, and the rain's own
mesh is reachable as the `unmirrored` entry named `rain`. Loading alone is not
the repro — the sheet is stood up by a frame, so the test has to call
`env.update(...)` under the wet sky first.
