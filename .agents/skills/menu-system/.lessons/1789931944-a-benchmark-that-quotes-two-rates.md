---
title: A breakdown must be measured against something WIDER than the phases it subtracts, and a median is the wrong summary of a run with two kinds of frame in it
date: 2026-09-20
scope: pwa/src/game/benchmark.ts, pwa/src/game/benchmark-report.ts, pwa/src/game/renderer.ts, pwa/src/game/scene-tally.ts
concepts: [benchmark, profiling, reporting, reflections, renderer, file-size]
---

Three faults in one report, all of the same family: the instrument was
describing itself rather than the machine.

**A RESIDUAL LINE IS ONLY HONEST IF ITS TOTAL IS MEASURED WIDER THAN THE
PARTS.** `wall` was `performance.now()` taken around the phases inside one
frame, and `unbilled` was `wall` minus those same phases — so it could only
ever be the clock's rounding, while its caption said "a collection, the
compositor". The real between-frames time (the pump's hop, the compositor,
the card's own redraw on a reading) fell outside `wall` entirely and showed
up as the report quoting TWO frame rates a few percent apart: a headline
scored off real elapsed time, and a breakdown footer scored off the sum of
the phases. 68 fps against 72. Bill the frame's whole PERIOD instead — hand
`benchFrame` the stamp the previous frame ended on, and give it back the
stamp this one ended on so the pump uses one reading for the period, the
rate and the elapsed — and the two numbers become one. The gap then gets a
line of its own rather than being an inference a reader has to draw by
holding two columns up against each other.

**A MEDIAN OF A BIMODAL DISTRIBUTION REPORTS A FRAME NOBODY DREW.** At
REFLECTIONS ▸ GLOW the mirror pass runs every OTHER frame
(`REFLECTION_LOOK.every`), so draw calls and triangles have two values and
nothing in between: measured on a dozen craft on the warm coast, every frame
was about 70 calls or about 120, and the median read 99. Worse, it hid the
one thing the block is read for — REFLECTIONS is often the last picture row
still above its floor, and what its next press down is worth is exactly the
gap between the two numbers. State both, keyed off whether the pass actually
DREW (`mirrorCalls > 0`) and never off whether it took any time: at GLOW the
pass costs a third of a millisecond, which a clamped clock reads as zero
about as often as not.

**AND THE SAME `every: 2` MAKES THE PER-READING TABLE LOOK LIKE A FAULT.**
`SAMPLE_EVERY` is 15, which is odd, so consecutive readings land on opposite
sides of the cadence and the table alternates 86/156 draw calls down its
whole length. That is aliasing, not thrashing — worth knowing before
spending an afternoon on it.

**`renderer.ts` SITS AT THE §20.5 CAP, so instrumenting it needs room made
first.** It was 992 lines of 1000, and three stopwatches with the comments
this tree expects do not fit. The clean thing to take out is an INSTRUMENT
rather than a piece of drawing: `sceneTally` was a pure walk of an
`Object3D` that nothing in a frame calls, so it moved to `scene-tally.ts`
whole and gave back forty lines. Look for that shape before reaching for a
harder split.

**A SLICE MEASURED BY DIFFERENCE NEEDS A CLAMP.** `world` is the stretch
between two stamps with the water's own self-reported time taken back out of
it, and those are rounded independently — on a millisecond clock a 1 ms
water update inside a 1 ms stretch leaves it a hair negative. Every phase
timed by its own stopwatch is safe; the one computed as a remainder is not,
and a minus sign in this report reads as a bug in the game.
