---
title: Never wait on `waitForFunction` over the BENCHMARK — it polls on rAF, and the bench's MessageChannel pump starves rAF, so the wait times out while the run finishes fine underneath it
date: 2026-09-20
scope: pwa/src/game/benchmark.ts, pwa/src/game/menu-bench.tsx, scripts/screenshot.mjs
concepts: [benchmark, screenshots, surfaces, measurement, tooling]
---

`runBenchmark` pumps frames through a `MessageChannel` deliberately, because
it is the one scheduler a browser re-enters as fast as the work comes back —
so the main thread is saturated and `requestAnimationFrame` may never fire
for the length of the run. Playwright's `page.waitForFunction` polls on rAF
by DEFAULT. Waiting on one over a running benchmark therefore times out
however long you give it, while the run underneath completes normally: two
attempts died at 900 s each on a run that actually takes 75 s at 640×360.

Poll from the DRIVER side instead — `page.waitForTimeout` plus
`page.evaluate`, which are serviced over CDP between tasks — or pass
`{ polling: 250 }` to `waitForFunction` so it stops asking rAF. The card is
finished when a button reads RUN AGAIN; COPY DEBUG REPORT is beside it and
`navigator.clipboard.readText()` gets the report (grant
`clipboard-read`/`clipboard-write` on the CONTEXT, not the page).

**The symptom is indistinguishable from "the machine is slow", which is why
this is worth a lesson.** Under the software rasterizer these labs run on, a
benchmark genuinely does take minutes, so a timeout reads as a budget
problem and invites a retry at a smaller viewport — which changes nothing,
because the wait was structurally incapable of returning. Diagnose before
retrying: poll every fifteen seconds printing `document.body.textContent`
and the buttons present. The loading card counts out `Warming up on the
grid… (n/4)`, then the run card shows `‹ STOP`, then `RUN AGAIN` — three
states that say immediately whether anything is progressing.

Budget it honestly: with `BENCHMARK.frames` cut to 30 in a throwaway build,
the whole thing is ~75 s at 640×360 including the 180-frame warm-up. Restore
`frames` afterwards — `tests/benchmark_test.ts` holds the shipped value, so
a leaked 30 fails the suite rather than shipping.
