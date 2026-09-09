---
name: collision
description: "Use when working on the craft TOUCHING SOMETHING THAT IS NOT WATER — the hull meeting a skerry, a boulder or a reef, grounding on the sea bed, riding up a ramp, crossing a gate's line or passing through a ring, the soft push back from the level's bounds — and on what the events (`hit`, `ground`, `gate`, `airGate`, `missedGate`, `land`, `dive`) mean. Owns the contact model in engine/game/collision.ts, the gate logic in course.ts, and the stage-a-contact → LOOK verification loop. The damage engine is a placeholder and not this session's."
---

# Collision: the hull meeting what is not water

The sea is `water-feel`'s and the hull on it is `craft-physics`'s. This skill
owns the moments the hull meets something SOLID — rock, sea bed, ramp — and
the moments the course COUNTS something — a gate line crossed, a ring passed,
a gate missed. The two are one skill because they share the probes: the same
twelve points that read the wave read the ground and the ramp, and the same
path that crosses a gate line is the one the bounds push back.

Load **`write-code`** beside this one (always), **`craft-physics`** when the
answer involves what the hull does AFTER a contact (the slam, the dive, the
bounce), **`mapgen-improvement`** when the work touches where solids and
gates STAND, and **`test-scenario`** for staging exact contacts.

## The map — who owns what

| Piece | File |
| --- | --- |
| Solids: cylinder push-out against `level.solids`, restitution, the `hit` event | `engine/game/collision.ts` |
| Grounding: probes vs `level.ground` — normal force + friction, the `ground` event | `engine/game/collision.ts` |
| Ramps: a plane the probes ride on, hinged at the water at its rear edge, contact normal from its angle | `engine/game/collision.ts` reading `Gate.ramp` |
| Level bounds: a soft push back inside `level.bounds` | `engine/game/collision.ts` |
| Gates: line crossing (water) / ring pass (air), in course order; `missedGate` when the next gate is skipped by passing the one after it — the missed gate then counts as reached with a penalty | `engine/game/course.ts` (`gate`, `airGate`, `missedGate`, `finish`, the splits) |
| Reset to the last gate passed, facing the next | `engine/game/course.ts` + `step.ts` on the `reset` edge |
| Every number: restitution, friction, the push-out margin, the bounds' spring, the miss penalty | `engine/game/defs/tuning.ts` → `TUNING.collision`, `TUNING.course` |
| What a solid IS (kind, radius, top height) and where it stands | `engine/mapgen/types.ts` (`Solid`), placed by `compile.ts` under `rules.ts` — the `mapgen-improvement` skill |
| The landing and the dive — the slam itself | `engine/game/hull.ts` (the `craft-physics` skill); this skill owns what the `land` / `dive` EVENTS mean and when they fire |
| What the events mean to the app | `pwa/src/game/renderer.ts` (a plume, a shudder — later `visual-effects`), `hud.tsx` (the miss, the split) |
| Drawing the solids where the engine put them | `pwa/src/game/rocks.ts` |
| Drawing the gates and the ramps | `pwa/src/game/gates.ts` |
| Damage | `engine/game/damage.ts` and `pwa/src/game/damage-fx.ts` — PLACEHOLDERS with a header comment. Not this session's; a contact today costs speed and attitude, never a ledger |
| Tests | `tests/collision_test.ts` (solid push-out, grounding, ramp contact), `tests/course_test.ts` (gate order, splits, reset) |

## The events, and what each MEANS

| Event | Fires when | Carries |
| --- | --- | --- |
| `hit` | A probe's circle overlapped a solid this step and was pushed out | which solid, the closing speed, the normal |
| `ground` | A probe met the sea bed (ground height above the probe) | the depth, the closing speed |
| `launch` | The hull's last wet probe left the water | the speed, the pitch |
| `land` | A probe re-entered the water after `airborne` | the vertical speed, the pitch at entry |
| `dive` | A landing buried the bow probes past `TUNING.hull.diveDepth` | the depth, the speed lost |
| `gate` | The craft's path crossed a water gate's line, facing direction, in order | the gate index, the split |
| `airGate` | The CoG passed through a ring's disc, in order | the gate index, the split, the height margin |
| `missedGate` | Gate n+1 was taken with gate n still next | the gate index missed, the penalty |
| `reset` | The rider asked, and the craft was stood at the last gate passed | the gate index |
| `finish` | The last gate was taken | the total time, the splits |

**Each fires ONCE per occurrence.** A `hit` every step the hull leans on a
rock is a renderer playing a plume sixty times a second and a sim table
counting one contact as a hundred. The contact persists; the EVENT is the
transition into it.

## The invariants — each one is load-bearing

- **The engine owns every number and every decision.** The renderer draws a
  plume where the `land` event says, nothing more. New contact behaviour
  starts in `collision.ts`/`tuning.ts`, never in the renderer.
- **Solids are cylinders, and the hull is its probes.** A contact is a probe
  inside a solid's radius (plus the hull's margin), resolved by pushing the
  CoG out along the plan normal and reflecting the normal velocity by the
  restitution. Never special-case a KIND in `collision.ts`: a reef that the
  hull may skim over is a `top` below the draft in `types.ts`, and a skerry
  that stops it dead is a `top` above it — one rule, read off the data.
- **A reef is a solid the hull can pass OVER.** `Solid.top` is the rock's
  height above sea level; a probe higher than `top` does not touch it. That
  is what makes a reef awash a hazard at the trough and nothing at the crest
  — and it is why the contact reads the probe's WORLD height, never the
  CoG's.
- **Grounding is the sea bed as a solid, met by the probes.** The same probes
  that read the wave read `level.ground` under them; a probe below the bed
  takes a normal force along the bed's gradient (`fieldGradient`) and a
  friction against it. Depth ≥ 1.5 m along the path is a generator rule
  precisely so this never fires on the line — a `ground` event on the ideal
  path is a generator bug reported through the wrong module.
- **A ramp is a PLANE, not a lift.** The probes ride up it exactly as they
  ride the water: the ramp's surface height replaces the wave's where the
  probe is over the ramp's footprint, and the contact normal is the plane's
  own. The launch comes from the hull's momentum leaving the plane's top
  edge — nothing adds an impulse at the lip. A ramp that "throws" is a ramp
  whose angle and the craft's speed together throw; `rules.ts` sizes the
  ring to that, and a change here moves the ring's height.
- **Gates are counted on the PATH, not the position.** A water gate is
  crossed when the segment from last step's CoG to this step's crosses the
  buoy line, in the facing direction; a ring is passed when that segment
  crosses the ring's disc. Sampling position alone skips a gate at speed
  (25 m/s is 0.2 m per step — fine — but a swell can put the CoG through a
  ring's plane between samples on the way up and down).
- **A miss is FORWARD progress, penalised.** Taking gate n+1 with gate n
  still next fires `missedGate` for n, then `gate` for n+1, and the run goes
  on; nothing sends the craft back. Keep it that simple — a miss that
  demands a return is a run that ends in circles.
- **Bounds push, they do not stop.** The level's edge is a spring, not a
  wall: a craft leaving the bounds is pushed back proportionally to how far
  it is out, so a wide line costs speed and a runaway comes back. A hard
  clamp is a hull that stops dead on an invisible line.
- **After changing the craft's velocity in a contact, the probes are
  re-read next step, not this one.** A push-out that also re-solves
  buoyancy in the same step double-charges the water for a displacement
  that already happened.
- **Synthetic levels must state their solids.** A `flatLevel` with
  `solids: []` collides with nothing; a scenario that wants a rock says so
  (`skerryLevel` in `tests/support/levels.ts`), or the contact test tests
  nothing.

## Workflow

1. **Stage it.** Reproduce the contact exactly: a synthetic level with the
   one solid, ramp or shallow the scenario is about, `placeRun` at the
   moment, then step — both patterns live in `tests/collision_test.ts`.
2. **Tune defs first.** If the change is feel (bounces too hard, grounding
   too sticky, the miss too cheap), it is a `TUNING.collision` /
   `TUNING.course` number with units in the comment — not a model edit.
3. **Assert the rule you claim** in `tests/collision_test.ts` /
   `course_test.ts`: square into a skerry (pushed out, `hit` once, speed
   lost), skimming a reef at the crest (no contact) and at the trough
   (contact), grounding on a slope (pushed up the gradient), a ramp taken
   square (probes on the plane, `launch` at the lip), a gate crossed
   backwards (no `gate`), a gate skipped (`missedGate` then `gate`).
4. **Measure.** `make sim` before and after — watch `hit`, `ground`, `miss`
   and `fin`; bots must keep finishing at pace with all four at ≈ 0.
5. **Bench it.** `make ride SCENARIO=launch` (and `landing`, `dive`) — the
   strip shows the probes on the ramp, the lip, the arc and the re-entry
   with the numbers beside each cell, before and after.
6. **LOOK.** `make build`, then `make screenshots SCENE=launch` and
   `SCENE=landing` — the ring where the ramp throws, the plume where the
   hull lands.
7. Docs: `docs/riding.md` ("Contacts and gates"); the sim columns in
   `docs/simulation.md`; `docs/level-generator.md` if a rule about where a
   solid or a ramp may stand moved.

## Tuning intuition

- `restitution` low + friction moderate is what makes a brush past a
  skerry a scrape rather than a bounce; a square hit stops you either way.
- The push-out margin is the hull's half-beam plus a little — the
  analyzer's clearance check uses the SAME number (`analysis/` imports it),
  so moving it re-rolls levels.
- The miss penalty is seconds added to the clock. It should cost more than
  the detour back would have — otherwise skipping a gate is the fast line.
- The bounds' spring is sized so a craft at top speed comes back inside
  within a hull length or two; softer and a runaway is a long swim, harder
  and the edge reads as a wall.

## Skill self-improvement

Record lessons under `.agents/skills/collision/.lessons/` via the
**`skill-reflection`** skill. What belongs here: a contact that fired twice
and why, a gate the bot could cross without passing, a ramp whose probes
missed the plane — the class of failure, not the one-off.
