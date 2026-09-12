---
name: craft-physics
description: "Use when working on HOW THE HULL ANSWERS THE WATER — the buoyancy probes and the draft they float at, the hydrodynamic drag (skin friction, the keel's lateral bite, heave damping), planing lift as speed rises (Savitsky), the slam on re-entry and the dive a nose-down landing becomes, the waterjet's thrust and the engine behind it, nozzle steering (no thrust ⇒ no steering), the rider's lean, and flight and air control. Owns `engine/game/craft.ts`, `hull.ts`, `flight.ts`, `assist.ts`, `limits.ts`, `TUNING.hull` / `.pump` / `.flight` / `.assist`, and `make ride` — the lab that must run before and after any change here. Not the sea itself (`water-feel`) and not what separates the four craft (`craft-tuning`)."
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
  nozzle, the rider's lean, aero, and gravity. Knobs in `TUNING.pump`,
  `TUNING.rider`, `TUNING.planing`, `TUNING.capsize`.
- **`engine/game/flight.ts`** — the AIR: what the rider may still do once
  the last probe is dry (lean → pitch, steer → roll/yaw), the flat-plate
  pitch moment, the rotational damping. Knobs in `TUNING.flight`
  (`TUNING.air` is the air's density and nothing else).
- **`engine/game/assist.ts`** — THE ARCADE'S HAND, which models nothing:
  the landing caught at the end of a flight (`landingAssist`) and the
  slide taken out of a run up a ramp's deck (`rampAssist`). Knobs in
  `TUNING.assist.air` / `.ramp`, dials in `GameState.assist` /
  `.rampAssist`. Judged on its NULL case first — see the lessons.
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

### The flat bench — where a NUMBER about the craft comes from

`make ride` shows you what the hull was doing; it cannot give you a figure,
because every scenario rides a REAL sea. At speed the hull is airborne a
fifth of the steps and `planing` collapses under half, so a claim about how
hard the craft turns, how fast it stops or how long it takes to get there
is made on flat water or not at all.

- **Inside the runner**, that is `syntheticLevel({ windSpeed: 0.01 })` with
  `sea: { hs: 0.01 }` — the drag strip `tests/craft_test.ts` already uses.
- **A plain-Node bench CAN use the synthetic level.** `tests/support/synthetic.ts`
  imports `vitest` and spells the engine `@engine`, but both resolve in a
  scratch script: `aliasEngine('<repo root>')` from
  `scripts/lib/engine-alias.mjs` before the dynamic `import()` handles the
  alias, and vitest is a devDependency so its `beforeAll`/`afterAll` import
  resolves like any other. So import `syntheticLevel` directly and get a flat
  bed, a straight shore and a ramp — do not build a generated-level staging
  path you do not need.
- **On a GENERATED level**, stage at the course path's point of greatest
  `sampleField(level.offshore, …)` and head ALONG the offshore contour (the
  gradient there by central difference, `Math.atan2(gz, -gx)`). Staging at
  `level.start` on `level.start.heading` instead runs the hull ashore inside
  ten seconds, and what comes back is a craft grounding at 25 km/h reported
  as a deceleration — with every hand measuring the same, because beaching
  is what stopped all of them.
- **NEVER MEASURE AN ATTITUDE OFF `c.pitch`.** It is an Euler reading and
  `toEuler` folds it back at ±90° (the roll flipping 180° to compensate), so
  a hull rotating steadily nose-down through vertical reads 31° → 87° → −87°
  → 60°: every variant of a sweep comes back pinned near ∓90° and reads as
  "the knob does nothing", and a rotation differenced off it reports a
  completed flip with the WRONG SIGN. This trap has been met twice. Use
  `∫ −wx dt` over the airborne or submerged stretch for how far it rotated
  (body-frame, does not wrap), and `rotate(q, {x:0,y:1,z:0}).y` — the hull's
  own up in world — for whether it is still the right way up. Count per
  stretch and report the largest; a run-long total cancels itself.
- **Spin up before measuring.** `placeRun`'s `speed` is a placement, not a
  trimmed-out hull; give it ~14 s at full throttle first or the figure is a
  craft still accelerating.
- **On the RAMP bench, state a case as a FRACTION of the deck's half-width.**
  Every number in `TUNING.assist.ramp` is one, and R33 made the deck's width
  a per-run dial, so a case written in metres stops being marginal the
  moment the dial moves: doubling R8's deck turned "a metre off the
  centreline, six degrees off the axis" from a jump the bare physics lost
  into one it keeps unaided, and `tests/assist_test.ts` failed on a change
  that was working. Map the deck before repicking a case — `across` over
  fractions of the half-width against a few yaws takes seconds — and put
  the probe in `tests/`: vitest's `include` is `tests/**/*_test.ts`, so a
  scratch file anywhere else is silently "no test files found".
- **Quote a rate at a FIXED TIME and a time to half** — g at 0.5 s and 1 s,
  then seconds and metres to half speed. An average to a full stop is mostly
  the v² tail (a craft sits above walking pace for the best part of a minute),
  and half speed is what a rider actually feels going into a buoy. For a
  turn, quote lateral g and the time a 180 takes beside the radius: a radius
  alone hides that the craft also accelerated. And when the thumb is also on
  the BRAKE, neither degrees nor radius will do — quote the METRES OF PATH to
  swing the bow 90°, against the same corner on full throttle: a hull turning
  the same degrees while shedding speed has used far less water, and a radius
  measured down to a standstill reads a pivot as a corner.
- **A TURN is benched as its OWN run, re-staged, at a MATCHED entry speed.**
  Continuing a turn out of the acceleration run measures wherever the hull
  had drifted to — on a generated level that is a rock, a beach or the rim,
  and what comes back is a 3 m radius at 60 km/h that reads as a hull
  suddenly hooking. Re-stage at the outer point, give it a second or two
  straight, then put the lock on, and watch the run's own `hit`, `ground`
  and `capsize` events as the tell that the number is not a turn. Match the
  entry speed across the hands being compared, too: radius goes as v², so a
  change that raised the ceiling gets credited with a turn it never lost.

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
- **PLANING LIFT HAS A CEILING AND A VALID RANGE — AND A CLAMP IS NOT A
  FADE.** Savitsky's C_L is fit for trim τ of 2–15°, mean wetted length/beam
  λ up to ~4, and speed coefficient Cv of about 0.6–13; outside those the
  polynomial runs away. Clamp the inputs, cap the lift at what would lift
  the hull's weight plus a margin, and never let it fire with the probes
  dry. Lift with no cap is a craft that leaves flat water on its own. But
  the clamp bounds the INPUT, not the REGIME: a coefficient clamped to its
  band goes on firing at the band's edge value forever, which is the model
  quietly asserting that the last valid data point holds at any attitude.
  Every fitted band needs a fade OUT of it as well as into it — `trimGone`
  / `fadeFrom` in `TUNING.planing` is that fade for the trim, and without
  it a hull reared onto its tail carried its full planing weight on a
  bottom pointing at the sky. Where the fade starts is its own tuning and
  is NOT the band's edge: a ramp and a landing run past Savitsky's 15° and
  do still plane.
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
- **A CONTROL GAIN IS AN ACCELERATION, NOT A TORQUE.** The roster's pitch
  inertia runs 165 (dart) to 490 kg·m² (otter) — `inertia(spec)` in
  `hull.ts`, worth printing before sizing anything — so a gain stated in
  N·m means a different correction on every craft and a value tuned on the
  skiff is wrong at both ends. State it as rad/s² per rad of error and let
  the caller multiply by that axis's inertia: one dial, one correction on
  every hull, and the number reads as a spring (120 is √120 ≈ 11 rad/s, a
  quarter-period of about 0.15 s). Sizing shortcut: moving θ rad in t
  seconds needs roughly 2θ/t² of angular acceleration, which is arithmetic
  rather than a search.
- **THE PROBE LAYOUT IS CACHED BY `spec.id`.** `hull.ts` builds a craft's
  probes once and keys them on the id, so an in-process A/B of a
  hull-GEOMETRY knob measures the first variant every time and comes back
  with "no effect". Compare geometry across separate processes, or give the
  variant its own id.
- **EVERY FORCE HAS UNITS AND A SOURCE.** `TUNING.hull`, `.pump`,
  `.rider`, `.planing`, `.flight`, `.assist` each carry the unit and the
  model in the comment, and say whether the number is a measurement
  (ITTC's line, Savitsky's coefficients, ρ_air) or an arcade dial (the air
  control's authority, the lean's trim moment, the keel's yaw authority,
  either hand of the assist). The first kind is argued against the world;
  the second against `make ride` and its bench.

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
   **`tests/waves_test.ts`'s storm case is the ceiling every force change
   owes**: the hull rides an Hs 20 m sea (`createGame({ sea: { hs: 20 } })`)
   at full throttle with every reading finite, because each force reads the
   surface RELATIVE to its probe rather than the absolute height. A change
   that makes it NaN or throws the craft past `hull.maxSpeed` is a force
   that read an absolute height or velocity somewhere.
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
