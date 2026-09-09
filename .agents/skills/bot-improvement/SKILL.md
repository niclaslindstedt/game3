---
name: bot-improvement
description: "Use when improving the BOT RIDER (engine/sim/bot.ts) — how the bot reads the course and rides it: aiming the next gate, or the ramp's axis for an air gate, holding the throttle, leaning back on the ramp, levelling in the air. Kept deliberately minimal and measured with `make sim`. Drives the iterate loop: reproduce the bad behaviour at a known seed, form a hypothesis from the level plan and the report's counts, edit the decision code, re-measure. The target is HUMAN capability — a competent rider, never a superhuman one and never a handicapped one."
---

# Bot improvement

The bot in `engine/sim/bot.ts` is one source of truth: the headless simulator
(`engine/sim/simulate.ts`), the balance CLI (`scripts/simulate-run.mjs` /
`make sim`), and the sim tests all ride the SAME `botInput(state) →
CraftInput`. Improving the bot means improving that function so a botted run
rides like a **competent human** — the yardstick for every change. The bot is
also the balance instrument: if it stops taking ramps, launch regressions
stop showing in the sim table, so its competence is load-bearing for the
whole measuring workflow.

**Before starting, read this skill's lessons** —
`node scripts/skill-lessons.mjs bot-improvement --list`, then the ones this
task touches (`--scope=…`, `--concepts=…`). Load **`skill-reflection`** at
both ends of the session.

## The target: human capability, no handicaps — and MINIMAL

Tune toward the decisions a good rider makes, not toward superhuman precision
and not toward deliberate mistakes:

- **Do** aim at the next gate, hold the throttle (that is how a PWC steers),
  line up the ramp's axis well before it, lean back on the ramp for height,
  level the hull in the air for a flat landing, and ease off when the nose
  is buried.
- **Don't** add artificial imperfection (steering jitter, reaction delay,
  rubber banding). We want the bot to STOP doing dumb things, not to fake
  being bad.
- **Don't** let it do what a human never would: steer with the throttle shut
  (nothing happens — the nozzle needs flow), hold full lean back on flat
  water, aim the RING rather than the ramp (the ramp decides where the
  craft goes; the ring is where the ramp throws it).

**And keep it small.** This bot is a gate-aimer with a ramp routine, and it
should stay that way until a measurement says otherwise. There are no
profiles, no skill budgets, no rivals yet (Heads Up is a future mode); a
tunable belongs on a small `BOT` constant table at the top of `bot.ts`, with
units, not on a profile object nobody selects. When rivals come, the sibling
game's pattern applies: profiles as data handed to `simulateStage`, one
decision function, never a fork per bot.

If a competent rider wouldn't do it, the bot shouldn't. That is the whole
spec.

## Determinism is non-negotiable

The bot is a PURE consumer of `GameState`: it never mutates it and never draws
from the state's RNG, so a botted run is exactly as reproducible as a human's
would be (same seed + craft → identical digest — `tests/simulation_test.ts`
and `determinism_test.ts` assert this). Keep it that way:

- No `Math.random()`, no wall clock, no reads of the state's RNG.
- `botInput` is stateless — everything the bot knows is in the `GameState`
  (the course, the craft, `progress.nextGate`, the sea under it). If it ever
  needs a memory, the shape to copy is a module-level `WeakMap` keyed on the
  `GameState` object — never a field on `GameState`, and never something the
  caller threads.
- The bot **never reaches into physics internals** — it reads the same state
  the HUD reads and produces the same `CraftInput` a thumb produces. What
  the craft CAN do it asks `engine/game/limits.ts`, the same as `craft.ts`
  does. A bot that peeks at un-exported model internals is a bot that lies
  about rideability.

## The current riding model (so you don't re-derive it)

1. **Aim** — the FIRST gate ahead: the walk starts at the course's next gate
   and goes forward past every one the craft is already past, never
   backwards (a gate's plane is infinite, and on a course with corners a
   craft can be "past" one it has never been near). Then the gate's centre
   for a water gate; for an air gate, a point on the RAMP's axis behind the
   ramp, so the craft arrives square to it. Steering is proportional to the
   heading error, clamped to ±1.
2. **Throttle** — full, always, because the nozzle only steers with flow;
   eased only when the bow is buried (`submergedDepth` past a bar) so a
   dive does not become a second one.
3. **The ramp** — lean back from the moment the probes touch the ramp
   (`lean: +1`), for height.
4. **The air** — level the hull: lean toward zero pitch, steer toward zero
   roll, throttle held (it does nothing airborne, and it is ready the
   instant the intake is wet again).
5. **Reset** — never on its own initiative. A bot that resets is a bot
   hiding a stuck; let the sim's `fin` column report it.

## The iterate loop

1. **Reproduce.** `make sim SEEDS=<N> CRAFT=<id>` at the failing seed — read
   the row (misses, dives, groundings, hits, DNF).
2. **Look at the geometry.** `make level SEED=<N>` draws the course — see
   WHAT the bot fought (a ramp right after a tight gate? a skerry on the
   inside of the line? a gate in the swell's trough?) before hypothesizing.
   A bot failure on legal geometry is a bot bug; illegal geometry is the
   generator's (`mapgen-improvement`, and its analyzer should have caught
   it — say so).
3. **Hypothesize, then edit** `engine/sim/bot.ts`.
4. **Re-measure.** The failing seed first, then the full `make sim` sweep —
   all four craft, all seeds. One lucky seed proves nothing; the sweep's
   footer is the before/after. Watch for the coupling: a "bot fix" that
   changes the measured balance is retuning the instrument mid-experiment.
5. **Run the sim tests** — `npx vitest run tests/simulation_test.ts
   tests/determinism_test.ts`.
6. **Look at it** when the change is about style rather than survival: the
   screenshot harness stages scenarios, not bot rides, but `make ride
   SCENARIO=` can be pointed at the bot (the ride lab takes an input source)
   and the strip shows whether the ramp approach is square and the landing
   flat.

## The traps

- **No flow, no steering.** The single most common bot bug: easing the
  throttle to "line up" a gate, which is precisely when the craft stops
  turning. The bot steers WITH the throttle open and slows by turning, not
  by lifting.
- **Aim the ramp, not the ring.** The ring is where the ramp throws a craft
  arriving square at speed; aiming the ring from off-axis puts the craft up
  the ramp crooked and into the water beside the ring.
- **The sea moves the aim.** A gate in a trough is still a gate; the bot
  reads gate positions from the course, never from where the buoy is drawn.
- **A landing has a rider on it.** Levelling in the air is what keeps
  `dive` at zero in the table; a bot that stops levelling reads as a
  slamming-model regression that is not one.

## After a change

- `make lint` and the sim tests green; the `make sim` table in the PR
  (before/after).
- A bot change is a changelog call, not a `no-changelog` reflex: today the
  bot rides only the sim, so the label is right — but the moment it rides a
  rival the player can see, a decision change a player would notice gets a
  fragment.
- `docs/simulation.md` describes the riding model; keep it in step.
- Load **`skill-reflection`** before committing: record what this pass
  learned, prune the stale, promote the always-true into the model
  description above.
