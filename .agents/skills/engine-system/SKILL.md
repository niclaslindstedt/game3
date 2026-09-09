---
name: engine-system
description: "Use when adding or changing a gameplay system (a sea-state rule, a craft capability, a gate kind, a scoring rule, run phases, the reset rule, a new event…). Walks the engine-first workflow: tune defs, extend state/events, implement in the fixed-timestep step pipeline, test headlessly, measure with the sim, then wire rendering and HUD in the app layer."
---

# Adding a Gameplay System

Gameplay lives in the **engine** (`engine/`, framework-free TypeScript); the
**app** (`pwa/`) only draws state and reacts to events. Keep that direction:
the engine never knows a renderer exists. This is what makes every game rule
unit-testable in plain Node, and every run reproducible from a seed.

**Before starting, read this skill's lessons** —
`node scripts/skill-lessons.mjs engine-system --list`, then the ones this task
touches (`--scope=…`, `--concepts=…`). Reading them here and reflecting on them
before the commit is the **`skill-reflection`** skill's job — load it at both
ends of the session. Load **`write-code`** beside this one on every system
change — it owns the craft rules (comments, file caps, the edit loop).

## Where the pieces go

| Piece | File |
| --- | --- |
| Global feel tuning (buoyancy damping, planing, slamming, the jet, the lean, the air, the reset) | `engine/game/defs/tuning.ts` — units in the comments (m, m/s, s, rad, kg); never inline in the model |
| Per-craft numbers, or a new craft | A data row in `engine/game/defs/craft.ts` — the model never branches per craft; the `craft-tuning` skill |
| State shapes & events | `engine/game/state.ts` — `GameState`, `CraftState`, `CraftInput`, `Progress`, the `GameEvent` union |
| The rigid body and its forces | `engine/game/craft.ts` (the body, the jet, the steering, the lean, aero), `hull.ts` (the probes: buoyancy, drag, planing, slamming), `flight.ts` (the air) — the `craft-physics` skill |
| The sea | `engine/game/water.ts` (pure functions of `x, z, t`) + `wind.ts` — the `water-feel` skill |
| Contacts: ground, solids, ramps, gates | `engine/game/collision.ts` — the `collision` skill |
| Run orchestration (phase, progress, splits, reset, finish, event emission) | `engine/game/step.ts` — `createGame` and the fixed 120 Hz `step`; `course.ts` for gate order and splits |
| Standing the craft at a moment | `engine/game/place.ts` — `placeRun(state, moment)`; the `test-scenario` skill |
| What a craft CAN do | `engine/game/limits.ts` — read by `craft.ts` AND `sim/bot.ts`; never restate a ceiling |
| Level generation rules / vocabulary | `engine/mapgen/rules.ts` + `generate.ts` + `compile.ts` — the `mapgen-improvement` skill |
| Bot behavior | `engine/sim/bot.ts` — the `bot-improvement` skill |
| Generic helpers (any game could use) | `engine/lib/` — the pool a later game keeps as-is |
| Public surface | `engine/index.ts` — export new types/constants the app or tests need |
| Tests | `tests/<topic>_test.ts` (vitest, `@engine` alias, synthetic levels — see the `test-scenario` skill) |
| Anything drawn | `pwa/src/game/` (`renderer.ts`, `water-mesh.ts`, `terrain.ts`, `rocks.ts`, `gates.ts`, `craft-body.ts`, `camera.ts`) |
| HUD / touch controls | `pwa/src/game/hud.tsx`, `hud-touch.tsx`, `hud-dial.tsx` + `pwa/src/styles.css` — the `hud-and-menus` skill |
| Input mapping | `pwa/src/game/input-model.ts` (DOM-free) + `input.ts` (DOM) |
| Placeholders for what is not built (damage, tricks, sound, sky, menus…) | the placeholder file named in `AGENTS.md`'s tree, with its header comment — a new system that belongs to one of them starts THERE, not beside it |

## Workflow

1. **Defs first.** Add the system's numbers to `engine/game/defs/tuning.ts`
   (global feel) or `craft.ts` (per craft), with units in the comments and
   the model each is drawn from. If you can't express the knob there, the
   design isn't ready. The model reads the defs; it never hard-codes a number.
2. **Types.** Extend `engine/game/state.ts`. Anything the app must react to
   (a launch, a landing, a dive, a gate, a hit) becomes a `GameEvent` variant
   — events are the ONLY channel from simulation to presentation.
   `state.events` holds the events THIS step emitted and is cleared at the
   top of the next, so the app reads it after every `step` and never misses
   or double-plays one.
3. **Simulate.** Implement the rule in `craft.ts`/`hull.ts`/`flight.ts` (per-tick
   body physics), `collision.ts` (contacts), `course.ts` (progress) or
   `step.ts` (orchestration), inside the fixed 120 Hz timestep. Mutate state
   in place; respect the phases (`running` / `finished`). Keep per-tick
   allocation near zero — `step()` runs 120×/s and the sim harness runs it far
   faster than that. Semi-implicit Euler: forces → velocity → position, in
   that order, once.
4. **Test headlessly** in `tests/`: build a synthetic level (a flat sea bed
   at a chosen depth, a straight course), hand it to `createGame({ level,
   wind })` on a calm sea unless the wave is the subject, run scripted inputs
   step by step, assert on state + events (the `test-scenario` skill has the
   recipes). Every rule you claim ("no thrust with the intake out of the
   water") gets an assertion. `npx vitest run tests/<file>` to iterate.
5. **Export** what the app needs from `engine/index.ts`.
6. **Measure.** `make sim` before and after — the balance table is the
   regression surface, and bots must keep finishing and keep hitting gates
   (the `simulate-run` skill reads the table). A new system that changes what
   a run looks like usually also earns a column in `RunReport` or an event
   the report counts. If the system has a lab (`make ride`, `make waves`),
   that too, before and after.
7. **Present.** Wire the events and state into the renderer/HUD in
   `pwa/src/game/` — the renderer reads `GameState`; it never steps physics
   and never mutates state. A moment worth photographing earns a scenario in
   `scenarios.ts` in the same change.
8. **Playtest** with the `playtest` skill (`make screenshots SCENE=…`) — numbers
   that look right in a test can still read wrong at speed in the real renderer.

## A worked example: a new gate kind

Say the course gains a SLALOM gate — a single buoy that must be passed on a
stated side.

1. `engine/mapgen/types.ts`: `Gate.kind` grows `"slalom"` and a `side`
   field. (`types.ts` is shared with the generator — tell the orchestrator
   before changing an exported shape.)
2. `rules.ts`: where a slalom may stand (spacing, offshore band), as data;
   `generate.ts` places it; `compile.ts` bakes it; `analysis/` checks it.
3. `course.ts`: the pass test — the craft's path crossing the buoy's
   abeam line on the stated side — in course order, with `missedGate` when
   the wrong side is taken. `state.ts`: nothing new if the existing `gate` /
   `missedGate` events carry it; a new field on the event otherwise.
4. `tests/course_test.ts`: a synthetic level with one slalom; pass on the
   right side → `gate`; pass on the wrong side → `missedGate`; pass wide →
   nothing yet.
5. `sim/bot.ts`: aim at the buoy offset to the stated side (the
   `bot-improvement` skill) — a gate the bot cannot take is a gate the sim
   cannot measure.
6. `make sim` before/after; `make level SEED=` shows the buoy on the plan.
7. `pwa/src/game/gates.ts` draws it; the HUD's `n / N` needs nothing.
8. `docs/level-generator.md` (the rule), `docs/riding.md` (the pass test), a
   changeset fragment.

## Invariants to preserve

- `step()` must stay deterministic for (seed, input sequence) — no wall clock,
  no `Math.random`, no DOM. Everything random draws from the seeded RNG in the
  state (`engine/lib/prng.ts`). The sim digests (`tests/simulation_test.ts`,
  `determinism_test.ts`) enforce this: break determinism and they fail.
- **The water is a pure function of `(x, z, t)`**, built once per level. A
  system that wants the sea to REMEMBER something (a wake, a splash) keeps
  that memory in `GameState`, never in `SeaState`, and never lets the renderer
  and the engine read different surfaces.
- The engine imports nothing from `pwa/` and nothing from three.js or Preact;
  the app imports `@engine` and nothing deeper. `tests/imports_test.ts` holds
  the direction.
- The timestep is fixed (`TUNING.physicsHz`, 120). The app's loop
  (`run-loop.ts`) accumulates real time into fixed steps, clamped — never make
  a rule depend on frame rate.
- Docs move with the code per `AGENTS.md`'s sync table: craft changes update
  `docs/riding.md`, water changes `docs/water.md`, generator changes
  `docs/level-generator.md`, sim/bot changes `docs/simulation.md`; a new
  command updates the README.
- A user-visible change ships a `.changes/unreleased/` fragment (the
  `changelog` skill).

## Skill self-improvement

Load the **`skill-reflection`** skill at both ends of the session — it owns
recording what a pass learned (with a `scope` and `concepts`), fixing anything
here the pass proved WRONG, pruning the stale, merging the duplicated, and
promoting the always-true. When a new system forces a pattern not covered here
(a timed hazard, a scoring multiplier, a gate that moves…), record where it
landed and why.
