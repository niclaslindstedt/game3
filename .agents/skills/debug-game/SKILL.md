---
name: debug-game
description: "Use when investigating a gameplay bug, physics glitch, visual problem, or crash. Covers reproducing deterministically with a seed plus a scripted input sequence, classifying by layer (engine vs renderer vs input vs generator), reading the engine's output module, and locking the fix with a failing test first."
---

# Debugging the Game

The engine is deterministic by construction: `createGame({ seed, craft })` +
a fixed sequence of `step(state, input)` calls always produces the same run —
same level, same sea, same physics, same events. Almost every gameplay bug
can therefore be reduced to a **seed + input script**, reproduced headlessly,
and locked in with a test. Prefer that route over clicking around in a
browser. The URL carries `seed`, `craft`, `scene` and `t`, so a bug report's
address bar is the repro's first ingredient.

**Before starting, read this skill's lessons** —
`node scripts/skill-lessons.mjs debug-game --list`, then the ones this task
touches (`--scope=…`, `--concepts=…`). Reading them here and reflecting on them
before the commit is the **`skill-reflection`** skill's job — load it at both
ends of the session.

## Instruments

| Instrument | How |
| --- | --- |
| Deterministic repro | `createGame({ seed, craft })` + fixed `step()` loops in a scratch vitest file — or a synthetic level and a `placeRun` via the `test-scenario` skill |
| Bot repro | `simulateStage({ seed, craft, maxSeconds })` (`engine/sim/simulate.ts`) — a whole botted run, headless, with the counts and the digest in the `RunReport` |
| Determinism check | The `digest` in `RunReport` — two runs of the same seed/craft must hash identically; a digest drift IS the bug report for nondeterminism |
| The sea at a point | `surfaceAt(sea, level, x, z, t)` called directly — a wave that misbehaves is reproduced with four numbers, no craft needed; `make waves SEED=` draws the whole transect |
| The hull over time | `make ride SCENARIO=` — a strip of the craft crossing the water, with speed, pitch, wetted share, rpm and air time per cell; the first thing to run on any "the craft does X" report |
| Engine log | `engine/output.ts` — the semantic output module (`status/info/warn/error/debug`) with a pluggable sink; in the browser it feeds `pwa/src/output-bridge.ts`. Engine code prints through it, never bare `console.*` |
| Level geometry | `make level SEED=` — the plan with every gate, ramp and solid labelled; LOOK at where the bug happened |
| The real renderer | `make screenshots SCENE=` (the `playtest` skill), or `npm run dev` headed — for anything only pixels can show |

## Process

1. **Classify by layer first:**
   - **engine bug** → state values are wrong (position NaN, speed exploding,
     `airborne` stuck, `wetted` at 0 on a hull that is plainly afloat, a
     gate never passed, `phase` never reaching `finished`). Reproduce
     headlessly; the renderer is not involved. A NaN in the craft is nearly
     always a probe reading the surface at a point outside the level's
     bounds, or a division by a `wetted` of 0 — check both before anything
     subtler.
   - **water bug** → the sea itself is wrong (a wave growing without bound, a
     trough below the bed, a surface that differs between two calls at the
     same `(x, z, t)`). `water.ts` is a pure function — reproduce it with
     the four numbers and the `water-feel` skill's lab.
   - **render bug** → state right, pixels wrong (the hull floating above or
     under the drawn water, the terrain's waterline off, the ring drawn
     somewhere the ramp does not throw, camera pops). The renderer reads
     `GameState` and never writes it — if the strip is right and the screen
     is wrong, the bug is in `pwa/src/game/`. The hull-vs-water gap in
     particular is `water-mesh.ts` not calling the engine's `surfaceAt`, or
     calling it at a different `t`.
   - **input bug** → `CraftInput` wrong before the engine ever sees it (a
     lever that reads 1 on touch, a lean that never reaches −1, a `reset`
     that fires every step instead of once). `input-model.ts` is DOM-free —
     reproduce in `tests/input_model_test.ts`.
   - **generator bug** → the level itself is illegal or ugly (a gate over
     rock, a ramp with no run-up, a course leaving the offshore band). That
     is the `mapgen-improvement` skill's loop — `make level` and
     `make analyze` first.
2. **Engine bugs: write the failing test BEFORE the fix.** Arrange the exact
   scenario in `tests/` — a synthetic level shaped for the bug, a `placeRun`
   at the moment, scripted inputs stepped until the bad state appears —
   assert the correct behavior, watch it fail, then fix `engine/game/*`. The
   test stays forever; the bug can't return silently. Name it after the
   behavior, not the bug number.
3. **Physics bugs that only bots hit:** reproduce with `simulateStage` at the
   reported seed, then read the counts — dives, groundings, hits, missed
   gates — and `make level` for the geometry they happened on. A bot failure
   on legal geometry is a bot bug (`bot-improvement`); illegal geometry is
   the generator's.
4. **Render bugs:** reproduce with `make screenshots SCENE=` (add a scenario
   to `scenarios.ts` if none captures the moment), and compare against the
   ride strip for the same scenario to separate "state is wrong" from
   "drawn wrong".
5. **Nondeterminism** (digest drift, a shared seed differing between
   devices): the cause is almost always a draw outside the state's seeded
   RNG, a wall-clock read inside the engine, or the sea being built from the
   GUSTED wind rather than the level's mean wind. Grep `engine/` for
   `Math.random` and `Date.now` first — both are banned there — then check
   that `createSea` reads `level.wind`, never `state.wind`.

## Skill self-improvement

Load the **`skill-reflection`** skill before this session commits. What is
worth a fragment here is the diagnosed root-cause _class_ (a layer-classifying
tell, a repro technique), never the one-off bug.

```sh
node scripts/skill-lessons.mjs debug-game --list
```
