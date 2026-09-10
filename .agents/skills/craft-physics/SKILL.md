---
name: craft-physics
description: "Use when working on HOW THE HULL ANSWERS THE WATER — the buoyancy probes and the draft they float at, the hydrodynamic drag (skin friction, the keel's lateral bite, heave damping), planing lift as speed rises (Savitsky), the slam on re-entry and the dive a nose-down landing becomes, the waterjet's thrust and the engine behind it, nozzle steering (no thrust ⇒ no steering), the rider's lean, and flight and air control. Owns `engine/game/craft.ts`, `hull.ts`, `flight.ts`, `limits.ts`, `TUNING.hull` / `.jet` / `.air`, and `make ride` — the lab that must run before and after any change here. Not the sea itself (`water-feel`) and not what separates the four craft (`craft-tuning`)."
---

# The craft's physics

This skill owns **one question**: given the surface under it, what does the
hull do next?

Three modules answer it, and the split matters:

- **`engine/game/hull.ts`** — the PROBES: ~12 points laid out from the
  spec's length, beam and deadrise, each owning a share of the displaced
  volume, each reading `surfaceAt` and answering with buoyancy, drag,
  planing lift and slamming. Knobs in `TUNING.hull`.
- **`engine/game/craft.ts`** — the BODY: a rigid body at 120 Hz
  (semi-implicit Euler; a quaternion for orientation, angular velocity in
  the body frame), summing the probes' forces and torques with the jet, the
  nozzle, the rider's lean, aero, and gravity. Knobs in `TUNING.jet`,
  `TUNING.rider`, `TUNING.aero`.
- **`engine/game/flight.ts`** — the AIR: what the rider may still do once
  the last probe is dry (lean → pitch, steer → roll/yaw), the flat-plate
  pitch moment, and the landing hand-back. Knobs in `TUNING.air`.
- **`engine/game/limits.ts`** — what a craft CAN do (max rpm, max nozzle
  angle, max lean), stated once, read by `craft.ts` AND `sim/bot.ts`.

**Read this skill's lessons first** —
`node scripts/skill-lessons.mjs craft-physics --list`.

| Load beside this one | For |
| --- | --- |
| `water-feel` | the surface the probes read, and the orbital velocity in the drag |
| `craft-tuning` | the catalog's per-craft numbers, and the roster they have to stay a roster across |
| `collision` | the probes meeting the bed, a rock or a ramp instead of water |
| `game-feel` | whether the answer READS as a hull meeting a wave |
| `test-scenario` | staging a rest, a launch, a dive on a synthetic level |

## The forces, and where each is written down

Each force is stated ONCE, with its source in the comment above it. Change a
term and the comment's claim has to stay true.

| Force | Model | Where |
| --- | --- | --- |
| Buoyancy | Archimedes: per probe, the submerged share of its volume from the surface height minus the probe's depth, smoothly clipped; F = ρ g V, ρ from `level.water.density`; torques from the probe offsets | `hull.ts` — `probeBuoyancy` |
| Hydrodynamic drag | Quadratic against the RELATIVE velocity (orbital velocity included), split three ways: longitudinal on the ITTC-57 friction line, lateral as the keel/sponsons (large — this is what makes it carve), vertical as heave damping | `hull.ts` — `probeDrag` |
| Planing lift | Savitsky (1964): C_L0 = τ^1.1 (0.0120 λ^0.5 + 0.0055 λ^2.5 / Cv²), deadrise-corrected C_Lβ = C_L0 − 0.0065 β C_L0^0.6, lift ∝ ρ V² B² C_L, clamped to the method's valid ranges | `hull.ts` — `planingLift` |
| Slamming | von Kármán (1929) / Wagner (1932) wedge impact: added vertical damping ∝ ρ v_z² × the wetted-area growth rate, per probe, on re-entry | `hull.ts` — `slam` |
| Propulsion | Waterjet momentum theory: Q = A_n V_j, V_j from rpm × impeller pitch, T = ρ Q (V_j − V_in), V_in ≈ the hull's speed through the water; zero when the intake probe is dry | `craft.ts` — `jetThrust` |
| The engine | A torque curve vs rpm from the spec, a pump absorbing P ∝ rpm³, rpm integrating (T_eng − T_pump)/I from idle to the spec's redline; free-revving when the intake is dry | `craft.ts` — `stepEngine` |
| Steering | The nozzle deflects ±`nozzleAngle`; yaw moment = T sin δ × lever; a small hull-keel yaw authority beside it — NO thrust ⇒ almost no steering | `craft.ts` — `steer` |
| Roll into the turn | The lateral force acting below the CoG, plus the rider's lean (steer × `leanIn`); the rider is a point mass at `riderHeight` even though nothing draws it | `craft.ts` — `riderMoment` |
| Lean (the input) | The rider mass shifted fore/aft → a trim moment afloat; the pitch control in the air | `craft.ts` afloat, `flight.ts` airborne |
| Aero | ½ ρ_air C_dA v_rel² against the wind-relative velocity (ρ_air 1.225), plus a flat-plate pitch moment in flight | `craft.ts` — `aero` |
| Gravity | g on the CoG | `craft.ts` |
| Air control | `lean` → pitch rate, `steer` → roll/yaw rate, with enough authority that a full backflip is REACHABLE from a big ramp with lean held back — reachable, not scored | `flight.ts` |

## The instrument: `make ride`

A hull crossing a wave is a dozen numbers changing together over a second,
and watching it in the game shows spray. So do not: stage it on the bench and
read it.

```sh
make ride SCENARIO=rest              # ONE scenario — the flag takes one name
make ride SCENARIO=chop
npm run ride -- --all                # every scenario, one picture each
npm run ride -- --scenario carve --craft otter --seed 3 --every 0.1
```

It writes `previews/ride-<scenario>.png` and prints a table. The strip is
the craft's SIDE PROFILE every 1/6 s over the water profile it crossed,
drawn to scale — the probes marked, wet ones filled — with the numbers
beside each cell: speed, pitch, wetted share, rpm, planing, air time, and
the step's vertical speed. **The table is what a claim gets made out of;
the strip is what tells you which number to go and look at.** A hull that
porpoises is a row of pitch values alternating sign; a hull that dives is a
wetted share jumping to 1 with a pitch going negative; a hull that never
gets on the plane is a planing column stuck under 0.5 at full rpm.

The scenarios are `pwa/src/game/scenarios.ts` (DOM-free; the `test-scenario`
skill owns adding one). The ones this skill reads most:

| Scenario | What it isolates |
| --- | --- |
| `rest` | The draft: the hull afloat on a calm sea, throttle shut — must settle at the depth its mass and displacement imply, and STOP moving |
| `cruise` | The hump and the plane: full throttle from rest on calm water — the planing column rising, the drag dropping, the speed reaching the catalog's `topSpeed` |
| `carve` | The turn: steer held at speed — roll into it, the nozzle's moment, the speed bled; then the same with the throttle shut — nothing happens, and it should |
| `chop` | The head sea: small slams, the pitch rhythm, no dives |
| `swell` | The long wave: lift, crest, drop, the launch a big one gives |
| `launch` / `apex` / `landing` | The ramp: the lip, the ballistic arc, the flat landing's slam |
| `dive` | The nose-down landing: bow probes buried, the pitch-down, the speed lost |
| `backflip` | Lean held back off the big ramp — the rotation must complete and the landing must be survivable |

**Run it BEFORE the first edit and AFTER the last**, on every scenario the
change plausibly reaches, and put both tables in the PR. It drives the
engine directly — no build, no browser, seconds.

## The rules

- **THE HULL FLOATS AT THE DRAFT ITS NUMBERS IMPLY.** Mass over displacement
  is a density; density against the water's decides how deep the hull sits
  at rest, and `tests/buoyancy_test.ts` holds it (rest draft within a
  tolerance; a denser craft sits lower; a capsized craft comes back up).
  The probe layout is what makes that true — their volume shares sum to
  the spec's `displacement`, and their heights put the metacentre above the
  CoG. A hull that sits wrong at rest is wrong everywhere else too, so
  `SCENARIO=rest` is the first strip after any probe change.
- **THE CLIP IS SMOOTH, AND THE DAMPING IS REAL.** A probe's submerged
  volume goes from 0 to full over a depth, not at a line — a step function
  is a hull that chatters at the waterline at 120 Hz. And a buoyant body
  with no heave damping bobs forever: the vertical drag is what settles it,
  and `rest` must reach stillness within a couple of seconds.
- **PLANING LIFT HAS A CEILING AND A VALID RANGE.** Savitsky's C_L is fit
  for trim τ of 2–15°, mean wetted length/beam λ up to ~4, and speed
  coefficient Cv of about 0.6–13; outside those the polynomial runs away.
  Clamp the inputs, cap the lift at what would lift the hull's weight
  plus a margin, and never let it fire with the probes dry. Lift with no
  cap is a craft that leaves flat water on its own.
- **SLAMMING READS THE PROBE'S OWN CLOSING SPEED.** v_z is the probe's
  vertical velocity relative to the surface (the surface moves too), not
  the CoG's. Charging the CoG's descent slams a flat landing at every
  probe at once, which is a craft that stops dead; charging every
  chattering step over chop is a craft that cannot cross a ripple. A slam
  is an ARRIVAL: it fires as the probe goes from dry to wet, scaled by how
  fast, and the wetted-area growth rate is what makes a flat entry hard
  and a knife-edge entry soft.
- **NO INTAKE, NO THRUST — AND NO THRUST, NO STEERING.** The jet's thrust
  is zero when the intake probe is dry, so the engine revs free in the air
  and the craft goes where it was thrown. And the nozzle's yaw moment is
  T sin δ, so with the throttle shut the craft goes straight on — that is
  the real off-throttle characteristic and the whole skill of the game.
  `tests/craft_test.ts` holds both (turn radius with vs without throttle;
  the off-throttle steering loss). The small keel authority is the
  ceiling; do not "help".
- **V_in IS THE SPEED THROUGH THE WATER.** Thrust is ρ Q (V_j − V_in), and
  V_in is the hull's velocity relative to the water at the intake, orbital
  velocity included — not the ground speed. Against a current or up a
  wave's face the difference is real.
- **THE ENGINE AND THE PUMP MUST MEET.** rpm integrates (T_eng − T_pump)/I;
  a pump curve that never absorbs the engine's torque is an rpm that runs
  past the redline, and one that absorbs it at idle is an engine that
  never revs. The redline in `limits.ts` is a hard ceiling, but a model
  that needs the ceiling to hold rpm is wrong — the curves should meet
  under it, at the spec's `maxRpm`, at the catalog's `topSpeed`.
- **THE CATALOG'S EXPECTATIONS ARE A TEST.** `topSpeed` and `accel0to50` on
  each craft's row are DERIVED expectations — what the physics is meant to
  reproduce from the row's mass, power, hull and drag — and
  `tests/craft_test.ts` checks the physics reproduces them within a stated
  tolerance. A change here that moves them is either a physics bug or a
  catalog that needs re-deriving; say which in the PR (`craft-tuning`).
- **ANGULAR VELOCITY IS BODY-FRAME, THE QUATERNION IS BODY→WORLD, AND IT IS
  RENORMALISED EVERY STEP.** `heading`, `pitch`, `roll` are DERIVED from `q`
  each step for the HUD, the camera and the bot — never integrated on their
  own, or a backflip's pitch wraps and the roll flips sign at the top.
  The quaternion helpers are `engine/lib/quat.ts`.
- **THE ROLL INTO A TURN COMES FROM BELOW THE CoG.** The keel's lateral
  force acts at the probes' height, under the mass, so a hard turn rolls
  the hull INTO the turn; the rider's `leanIn` adds to it. A lateral force
  applied at the CoG rolls nothing, and a hull that turns flat reads as a
  hovercraft.
- **THE AIR IS THE RIDER'S.** Once the last probe is dry, `flight.ts` has
  the controls: `lean` pitches, `steer` rolls and yaws, with authority
  sized so the backflip is reachable off the big ramp (`tests/flight_test.ts`
  proves it) and a flat landing is reachable off every ramp the generator
  builds. The aero pitch moment (nose up + headwind → the nose lifts) is
  on top, and it is what makes a launch into wind feel different from one
  downwind.
- **LANDING IS A HAND-BACK, NOT AN EVENT THE AIR DECIDES.** The hull is
  airborne while no probe is wet; the first wet probe hands the body back
  to `hull.ts`, and `land` (or `dive`) fires off that transition. Nothing
  in `flight.ts` counts time or decides a landing happened.
- **EVERY FORCE HAS UNITS AND A SOURCE.** `TUNING.hull`, `.jet`, `.rider`,
  `.aero`, `.air` each carry the unit and the model in the comment, and
  say whether the number is a measurement (ITTC's line, Savitsky's
  coefficients, ρ_air) or an arcade dial (the air control's authority, the
  lean's trim moment, the keel's yaw authority). The first kind is argued
  against the world; the second against `make ride`.

## Workflow

1. **Take the baseline first.** `make ride` on every scenario the change
   reaches (`rest` and `cruise` always), before the first edit — seconds.
2. **Find WHICH STEP the number goes wrong in, and which FORCE.** Not
   which second. Walk the run one step at a time and print any step where
   the speed, the pitch rate or the wetted share moves more than a
   fraction; a hull that is wrong is almost always one force firing when
   it should not (lift with the probes dry, a slam on a chattering probe,
   thrust with the intake out) and a long correct stretch after it that
   the average hides. When a ROTATION is wrong, print each torque's
   contribution per step — which term is feeding an axis is not something
   the net change can tell you.
3. **Then ask what that step was charged for.** In this module the answer
   has never once been "drag is too high" — it has been a force that fired
   on a probe that was not where the force assumed.
4. **Tune defs only after the model is honest.** Make the comment true
   before changing the number.
5. **Re-run the lab, the tests, then `make sim`** — `npx vitest run
   tests/buoyancy_test.ts tests/craft_test.ts tests/flight_test.ts`, then
   the table (`top`, `air`, `dive`, `avg` are where a hull change shows).
6. **LOOK.** `make build`, `make screenshots SCENE=chop` (and whichever
   scenario the change was about) — the hull sitting IN the water, the
   attitude reading.
7. Docs: `docs/riding.md` — the forces, the models, the lab.

## What the change obliges elsewhere

- `docs/riding.md` for any force, model or constant.
- `make ride` before/after on the reached scenarios, and `make sim`
  before/after, in the PR.
- A re-derived `topSpeed` / `accel0to50` on the catalog rows if the physics
  legitimately moved them (`craft-tuning`), with the roster read.
- A `.changes/unreleased/` fragment — the hull is what the player rides.

## Skill self-improvement

Record lessons under `.agents/skills/craft-physics/.lessons/` via the
**`skill-reflection`** skill. What belongs here: a force that fired where it
should not have and the tell in the strip that found it, a Savitsky input
that left its range on a real scenario, a probe layout that floated wrong —
the class of failure, not the one-off.
