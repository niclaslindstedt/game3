---
title: A surface that OWNS the canvas is a second, different "no" beside the pause card's — `simulates` and `appDraws` are two predicates, and the cursor sync has to sit above the handover
date: 2026-09-16
scope: pwa/src/game/shell.ts, pwa/src/App.tsx, pwa/src/game/app-load.ts
concepts: [shell, surfaces, menu-nav, benchmark]
---

The benchmark (`game/benchmark.ts`) pumps its own frames through a
`MessageChannel` as fast as the machine will draw them, so the app's own
`requestAnimationFrame` loop must neither step nor draw while one is up. That
LOOKS like the pause card's rule and is not: the pause card stops the clock and
goes on drawing, and this stops neither — somebody else is simply turning the
water. One predicate cannot say both, so `shell.ts` carries `simulates` AND
`appDraws`, and the guard in the loop is `if (!appDraws(shellRef.current))
return;` placed BELOW the load (the card that stands the race up is still
driven from the loop) and above everything else.

**What that early return quietly takes with it is the CURSOR.** `walk.walked()
&& nav.sync()` sat near the bottom of the frame callback, below the render, so
a surface that returns before it can never be walked on the keys — the ring
never appears and a controller cannot reach the card's own buttons. It has to
be hoisted above the handover. Anything else living below a `return` you add to
that loop is worth the same check: `__SH_COST__`, the first-visit probe and the
HUD tick are all down there, and all three are correctly skipped.

Two smaller things the surface needed. The status IS the surface — a
`useState<BenchmarkStatus | null>` non-null and `shell === "bench"` are set
together, so the card cannot be up without a run behind it. And `act()` gets an
early return that LEAVES the benchmark on any game key: none of a run's keys
mean what they usually mean over one, and every one of them is somebody
reaching for the way out. Escape never reaches it — `walkCardsOnKeys` takes
that in the capture phase and presses the card's `[data-nav-back]`.
