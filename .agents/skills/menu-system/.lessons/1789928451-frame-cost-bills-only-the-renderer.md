---
title: `cost.frameMs` bills only `render()` — a benchmark frame is sim + observe + render + fence, and per-frame phase times are noise under a clamped clock
date: 2026-09-20
scope: pwa/src/game/benchmark.ts, pwa/src/game/benchmark-report.ts, pwa/src/game/renderer.ts
concepts: [benchmark, performance, renderer, measurement]
---

`renderer.cost().frameMs` is timed from `t0` at the top of `render()` to its
end. `benchFrame` does FOUR things — `step()` × `STEPS_PER_FRAME` over the
whole field, `observe()` after each, `render()`, then `drain()` — so on a race
`frameMs` can read 6 ms on a machine drawing at 14 and say nothing about the
other 8. The missing half is the ENGINE: twelve runs stepped at 120 Hz behind
every drawn frame, none of it a draw call and none of it answering to
OPTIONS ▸ VIDEO. Anything timed outside `render()` has to be written by
`benchmark.ts` (`FrameTiming`), not by the renderer.

**Attribute the engine's half in pure Node, not in the browser.** `aliasEngine`
+ `createGame({...BENCHMARK-plan fields})` + timing `STEPS_PER_FRAME` steps
takes seconds and answers what a browser run cannot decompose at all. Count out
the lights and warm the JIT (~120 frames) before the first reading, or the
first hundred frames are the tier-up.

**A per-frame phase time is not measurable.** Browsers clamp
`performance.now()` — 1 ms in Safari, coarser without cross-origin isolation —
so a 0.3 ms pass reads as 0 or 1 and never as itself, and a MEDIAN of readings
taken that way is a median of noise. Sum each phase over the whole run and
divide by the frames; the rounding averages out and the mean is good to a few
hundredths. Counters (draws, triangles) are exact on the frame they are read,
so those stay medians — the two summaries in the report are computed
differently on purpose. Measure and print the clock's own resolution beside
them: it is the error bar on every per-frame column, and on an unknown device
it is the only way to know which half of the report to trust.
