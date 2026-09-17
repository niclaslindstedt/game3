---
title: A REPLAY is the ghost's tape with the world written beside it — one codec, and the tape must start at the run's own first step
date: 2026-09-17
scope: pwa/src/game/replay.ts, pwa/src/game/replay-run.ts, pwa/src/game/ghost.ts, pwa/src/App.tsx
concepts: [replay, ghost, determinism, shell, recording]
---

The whole feature is already paid for by `ghost.ts`: the six RLE'd control
streams, `snapInput`'s grid, and the rule that the engine is deterministic.
A replay is that tape plus how to REBUILD the afternoon, and a ghost is that
tape plus the figure it beat. Extracting `ControlTape` /
`createControlRecorder` / `readControls` out of `createGhostRecorder` cost
nothing and is the whole of the sharing — do not write a second encoder.

Three things that are not obvious and each of which shipped a broken replay
in this session before being caught:

- **The tape has to start at the run's OWN first step.** The rebuild starts at
  `t = 0`, so a recorder armed part way through a run replays from a moment
  the run never had. `App.tsx` steps the OLD state between `loader.begin`'s
  `build` and `app-load.ts`'s `adopt`, so the rig cannot gate on a surface —
  it takes the state with the controls and records only when
  `state === armed`. And `arm` refuses a state with `t > 0` outright, which is
  what a `?t=` pre-rolled link hands it.
- **Every input the engine is handed must be on the tape's grid, not just the
  player's.** The first steps of a recorded run are ridden by the BOT under the
  loading card, and `run.ts` throws those away only while the lights are on —
  a load that outlasts the 3 s countdown puts lock on the tape the tape cannot
  write down. `stepOnce` now snaps whatever `inputFor()` returned; snapping a
  snapped value is free.
- **A replay of a RACE keeps its field**, where a ghost drops it
  (`dropField`). The rivals are the bot off the same seeded stream, so they
  arrive at every buoy on the step they arrived on and cost nothing extra.

Verify it with the round trip and nothing softer: ride N steps recording the
raw floats of `craft.x/y/z/speed`, rebuild, and `toEqual` them. A replay that
is merely close is a craft somewhere else by the second buoy, and the drift
shows up at the twelfth decimal place long before it shows up on screen.
