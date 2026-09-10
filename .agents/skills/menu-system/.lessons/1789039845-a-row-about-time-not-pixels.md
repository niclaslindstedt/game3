---
title: A frame-rate cap is a picture row that skips WHOLE animation callbacks, phase-locked to the cap's grid, before the loop steps or draws anything
date: 2026-09-10
scope: pwa/src/game/frame-rate.ts, pwa/src/App.tsx, pwa/src/game/settings-video.ts
concepts: [frame-rate, options, video, run-loop, cap]
---

The FRAME RATE row (30 / 60 / MAX) is a `createFrameGate` in
`frame-rate.ts` asked at the top of `App.tsx`'s `frame` callback: a refused
frame returns before the clock, the steps, the water and the draw, and
leaves `last` alone so its wall time arrives with the next drawn frame — the
run clock takes elapsed seconds, so a capped loop rides the same run. Two
things the gate has to get right, both held in `tests/video_test.ts`: a
display at exactly the cap jitters its callbacks a hair early and late, so a
frame within a fifth of a period is taken; and the next frame is due one
period after the LAST one was due, not after the one that was drawn, or a
144 Hz display under a 60 cap lands on 72. A whole period late resyncs, so
a machine that cannot keep the cap draws every frame it gets and never
bursts. The fifth picture row fits both reference viewports (checked at
1280×720 and 390×844).
