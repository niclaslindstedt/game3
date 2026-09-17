---
title: Never assert on a TIMED read in a driven probe — the page is a software rasterizer running a 3D scene, and a CDP round trip can land seconds late
date: 2026-09-17
scope: scripts, previews
concepts: [screenshots, verification, surfaces, menu-nav]
---

A probe that does `mouse.down()`, `waitForTimeout(1200)`, then reads a label
and concludes the press did nothing is measuring CDP LATENCY, not the app. In
a web session the built site runs under a software rasterizer with the engine
stepping behind the card, and an instrumented run showed a `pointerdown`
landing 31.9 s after the page said it was ready. The same probe reported a
seven-second hold as "never started" on one run and as working on the next,
with no code change in between.

**Instrument inside the page instead of timing from outside.** Attach capture
listeners that push `{event, performance.now(), the element's box}` into a
global, do the interaction, then read the whole log in ONE `evaluate` at the
end. A log that shows `pointerdown` and no `pointerleave`, with the box the
same size throughout, settles both "did the press arrive" and "did the layout
jump out from under it" — neither of which a timed read can answer.

The corollary: a driven probe that fails ONCE in this environment has not
found a bug. Re-run it before believing it, and instrument before fixing it.
