---
name: test-scenario
description: "Use when a bug repro, a physics assertion, or a visual judgement needs the game in an EXACT situation — the hull at rest on a calm sea, a ramp taken at a known speed, a head sea at full throttle, a turn held with the throttle off, a nose-down landing. Covers staging synthetic levels handed to createGame({ level, wind }), standing the craft at a moment with placeRun, scripting inputs step by step, and photographing a named scenario in the built app with `make screenshots SCENE=`."
---

# Test Scenarios

Riding your way into a situation is slow and unrepeatable. This repo stages
situations **declaratively** instead: hand the engine a synthetic level shaped
for the scenario, stand the craft at the moment with `placeRun`, and script
the inputs step by step. The same technique backs every physics test
(`tests/buoyancy_test.ts`, `craft_test.ts`, `flight_test.ts`,
`collision_test.ts`, `course_test.ts`) — reuse it whenever you are
reproducing a bug, asserting a rule, or measuring a number.

## The synthetic level

`createGame` takes a `level` and a `wind`, and neither has to come from the
generator. A hand-built `Level` bypasses `mapgen` entirely, so the scenario
contains exactly what you put in it: a flat sea bed at one depth, a straight
course of a few water gates, no solids — or one ramp, one skerry, one reef,
whichever the scenario is ABOUT. Build it with the heightfield helpers
(`createHeightfield`, `fillField`) and the `Level` shape in
`engine/mapgen/types.ts`; nothing validates a hand-authored level against the
R-rules — that is the point: a scenario may stage geometry the generator
would never build.

```ts
import {
  NEUTRAL_INPUT,
  TUNING,
  createGame,
  placeRun,
  step,
  type CraftInput,
  type GameEvent,
  type GameState,
} from "@engine";
import { flatLevel } from "./support/levels.ts";

function game(craft = "skiff", depth = 8): GameState {
  // A calm sea isolates the hull from the wave field: zero wind is zero
  // spectrum, so every probe reads y = 0 and the only motion is the craft's.
  // Deepen the bed for a dive or a hard landing, so the physics is measured
  // rather than the grounding.
  return createGame({ seed: 0, craft, level: flatLevel({ depth }), wind: { from: 0, speed: 0 } });
}
```

`tests/support/levels.ts` owns the shared corpus (`levelFor(seed)` for the
generated ones, read-only) and the synthetic builders (`flatLevel`, a
straight course; `rampLevel`, one ramp and one ring; `skerryLevel`, a rock on
the line). Add a builder there rather than inside a test file when a second
file wants it.

## Standing the craft at a moment

`placeRun(state, moment)` (`engine/game/place.ts`) puts the craft AT a
`RunMoment` — a position, heading, speed, attitude, gate index and clock —
with the progress book reading as though it had ridden there. It is how
`scenarios.ts` stages every scene and how a test skips the run-up:

- a craft already planing at 25 m/s, 60 m before a ramp, for a launch test;
- a craft 3 m in the air, nose down, falling, for a dive test;
- a craft between gates 4 and 5 with three splits banked, for a reset test.

`placeRun` writes state and nothing else: the next `step` is what launches,
lands or resets, so assert on the events that step emits, exactly as for a
ridden one. A placed craft on a calm sea should be at rest after a second of
`NEUTRAL_INPUT` — if it is not, `placeRun` and the hull disagree about the
draft, and that is the bug.

## Scripting inputs

Drive the state with a fixed-step helper; seconds → steps via
`TUNING.physicsHz`:

```ts
function run(state: GameState, input: Partial<CraftInput>, seconds: number): GameEvent[] {
  const events: GameEvent[] = [];
  const steps = Math.round(seconds * TUNING.physicsHz);
  for (let i = 0; i < steps; i++) {
    step(state, { ...NEUTRAL_INPUT, ...input });
    events.push(...state.events);
  }
  return events;
}
```

Collect the events as you go — `state.events` holds THIS step's and is
cleared at the top of the next. They are the assertion surface for anything
transitional (`launch`, `land`, `dive`, `gate`, `airGate`, `missedGate`,
`hit`, `ground`, `reset`, `finish`).

## Rules of thumb

- **Stage, don't ride.** If a repro starts with "ride to the second air
  gate", replace the ride with a level whose first gate IS that ramp and a
  `placeRun` at speed 60 m before it.
- **Silence what you're not testing.** Zero wind isolates the hull from the
  sea; a deep flat bed isolates it from the ground; no solids isolates it from
  contacts; a craft with `steer: 0` isolates pitch from roll.
- **Build the precondition, then assert you built it.** A planing test runs
  `run(state, { throttle: 1 }, 6)` and then `expect(state.craft.planing)
  .toBeGreaterThan(0.9)` before measuring anything — so a tuning change that
  keeps the hull in the hump fails loudly at the precondition instead of
  silently passing a test whose scenario never happened.
- **Reference thresholds from `TUNING` and the craft's `spec`, not copied
  literals** — the test then tracks the tuning instead of pinning
  yesterday's numbers. The catalog's `topSpeed` and `accel0to50` are
  EXPECTATIONS the physics must reproduce within a stated tolerance; that
  tolerance is the one literal a craft test carries.
- **One scenario per behavior, named after the behavior.** The repro for a
  bug becomes the regression test; keep it in the topic's
  `tests/<topic>_test.ts`.
- **Whole-run scenarios** (does the bot finish this level?) go through
  `simulateStage` with a real seed instead — see the `simulate-run` skill.
- **The bench and the browser stage the SAME scenario.** A moment worth a
  test is usually worth a strip: name it in `pwa/src/game/scenarios.ts` (a
  `RunMoment` plus a scripted input over N seconds — DOM-free, so
  `tests/scenarios_test.ts` and `scripts/ride-lab.mjs` both read it), and
  `make ride SCENARIO=<name>` draws what the test measured.

## Staging in the real renderer

For a visual judgement (does the spray read? does the roll into the turn show
on camera?), the equivalent of a scenario is a **scene**: the same
`scenarios.ts` entry, opened by the harness at `?seed=&craft=&scene=<name>&t=`
and photographed after `t` seconds of its script. `make screenshots
SCENE=<name>` runs one (the `playtest` skill has the loop and the environment
notes). The screenshot harness drives `pwa/dist`, so `make build` first.

A scenario is therefore written ONCE and read three ways — by a test, by the
ride lab, by the screenshot harness — which is why it lives in a DOM-free
module and why a new one owes all three a look.

## Skill self-improvement

When a staging need doesn't fit the current engine surface (a `RunMoment`
field that does not exist, a level override the builders can't express),
grow `place.ts` / `tests/support/levels.ts` plus their tests, then document
the option here. Recurring stagings and gotchas are lesson fragments — load
the **`skill-reflection`** skill at both ends of the session
(`node scripts/skill-lessons.mjs test-scenario --list`).
