# Architecture

The repository follows the shape of its sibling rally repo: a headless engine that IS the game, a thin browser shell that draws it, and tooling that measures it. One direction of dependency, and a test (`tests/imports_test.ts`) that walks the real import graph and fails when an arrow points the wrong way:

```
tests/  scripts/(sim, the labs)            pwa/ (Preact + three.js shell)
        \                                   /
         `----------->  engine/  <---------'
           (framework-free TypeScript — imports nothing but itself)
```

`tauri/` and `native/` — the desktop and store shells — are reserved beside these as one README each. Neither exists yet; when they do they wrap the built site and import nothing else ([platforms.md](platforms.md)).

## `engine/` — the game, headless

The engine is a pure TypeScript module with no framework, no renderer, no DOM and no `node:` — it imports nothing outside its own tree, which is what lets the browser bundle, the headless simulator and the test runner all host it unchanged. Its public surface is `engine/index.ts`, spelled `@engine` by every host:

- `createGame({ seed, craft?, level?, wind?, quiet? })` builds a run: the level the seed generates (or the one handed in — the tests and the labs stage synthetic ones), the sea built from the level's wind and the seed, the wind state, a craft at rest behind the first gate at its rest draft, fresh progress.
- `step(state, input)` advances exactly one fixed 120 Hz step (`TUNING.dt = 1 / TUNING.physicsHz`) and leaves that step's events on `state.events`. The app's frame loop and the headless simulator call this same function — there is no other way to advance a run.
- `placeRun(state, moment)` stands a run at a moment instead of riding to it — a plan point, a heading, a speed, optionally a height and a climb, a pitch and a roll, a pitch rate — with the clock and the progress reading as though it had ridden there. The scenarios, the ride lab and the flight tests all stage through it, and the moment itself is still the engine's to emit: a placed flight lands on the next steps and fires `land` the way every landing fires.
- The sea (`createSea`, `surfaceAt`, `heightAt`, `seaSummary`, the fetch and dispersion functions), the wind (`createWind`, `stepWind`, `windAt`), the hull (`hullProbes`, `restY`, `inertia`, `totalMass`, `frictionCoefficient`), the planing surface (`planingLift`, `wettedLength`), the pump (`thrust`, `staticThrust`, `engineTorque`, `pumpTorque`, `jetVelocity`), the limits (`maxRpm`, `maxNozzle`, `MAX_LEAN`, `jetCeiling`, `airPitchTorque`, `topSpeedOf`), the contacts (`boundsPush`, `onRampDeck`, `rampDeckY`, `solidNear`), the course (`bearingToNext`, `crossedGate`, `resetPose`), the whole generator block (`export * from "./mapgen/index.ts"`: `generateLevel`, `LEVEL_RULES`, `analyzeLevel`, the heightfield readers, every level type), the simulator (`simulateStage`) and the bot (`botInput`, `RIDER_BOT`), and the generic pool (`createRng`, the noise, `clamp`/`lerp`/`angleDiff`, the quaternion algebra).

Determinism is a hard invariant: everything random draws from the seeded RNG in the state (`engine/lib/prng.ts`, mulberry32 — `state.rng = createRng(seed)`), never `Math.random`; the sea's phases draw from their own stream seeded `(seed ^ 0x5ea5ea)` at build time; `state.t` is the only clock the engine knows. A seed fully reproduces a level and a bot run, which is what the sim digests and shareable level URLs rely on. `tests/determinism_test.ts` replays a scripted run and asserts equality (§25.3's required guard), `tests/simulation_test.ts` asserts the digest, and `tests/imports_test.ts` refuses a wall clock, a global random source or a console anywhere under `engine/` — with one recorded exception, the analyzer's report timer (`analyzeLevel` stamps how long it took; it never steps a run).

Internally, by module:

- **`game/state.ts`** — the state and event types. Only `craft.ts`, `collision.ts`, `course.ts` and `step.ts` write it; everything else reads.
- **`game/step.ts`** — `createGame`, `freshCraft`, `step`: the orchestrator. The whole step order is stated in the next section.
- **`game/craft.ts`** — one step of the rigid body: every force summed, each from the module that owns its model, then one semi-implicit Euler integration ([riding.md](riding.md)).
- **`game/hull.ts`** — the hull as 22 probes (six keel stations, each with two chine probes, plus four deck probes at the gunwales): buoyancy, the drags, the slam, the bow's lift, the strip-wise planing lift. **`game/hydro.ts`** — Savitsky's planing lift coefficient. **`game/propulsion.ts`** — the engine, the pump, the jet, the nozzle. **`game/flight.ts`** — the air: drag, the flat-plate moment, the rider's authority, damping. **`game/collision.ts`** — the ground, the ramps, the rocks, the bounds. **`game/course.ts`** — gates, splits, the miss, the finish, the reset. **`game/limits.ts`** — what a craft CAN do, stated once for the physics and the bot. **`game/place.ts`** — `placeRun`.
- **`game/water.ts`** — the sea as pure functions of `(x, z, t)` ([water.md](water.md)); **`game/wind.ts`** — the mean wind, the log-law profile and the seeded gusts.
- **`game/defs/`** — the content: `craft.ts` (the four-row catalog), `tuning.ts` (every shared number, each with its unit), `fauna.ts` (placeholder). **`game/damage.ts`**, **`game/tricks.ts`** — placeholders that the state already carries (`freshDamage`, `NO_TRICKS`).
- **`mapgen/`** — the level generator ([level-generator.md](level-generator.md)): `rules.ts` (the rule book as data), `biomes.ts`, `shore.ts`, `geology.ts`, `course.ts` (the search; also the one statement of what a `Ramp`'s anchor means and where a ring goes), `generate.ts` (the bounded, deterministic sub-seed loop), `compile.ts` (bakes the two heightfields ONCE), `types.ts`, `index.ts` (the block's own surface), `fauna.ts` and `weather.ts` (placeholders).
- **`analysis/`** — the generator's scoreboard AND its accept gate: `generateLevel` rejects an attempt `analyzeLevel` finds an error in. Dev-time in spirit, but on the level's path, so it lives in the engine. `budgets.ts` holds how closely the checks read.
- **`sim/`** — `bot.ts` (the deterministic rider), `simulate.ts` (the harness and the digest), `tape.ts` (a placeholder for a run recorded) — [simulation.md](simulation.md).
- **`rating/`** — placeholder: whether a level is any GOOD, as against broken.
- **`lib/`** — the generic pool (§23.7 rule 5): `prng.ts`, `math.ts`, `noise.ts`, `heightfield.ts` (a bilinear grid, two lerps a sample), `quat.ts` (the orientation, and the one statement of the sign conventions). Nothing of THIS game is in it.
- **`output.ts`** — the §19.4 central output module: `status` / `info` / `warn` / `error` / `debug` / `header`, a pluggable sink, and a 200-line ring (`recentLogs`) so boot output survives until a host attaches. The app routes it into `pwa/src/output-bridge.ts`; the sim CLI leaves the default.

### The step pipeline, in the order `step.ts` runs it

1. **Housekeeping.** `state.events` is cleared, `state.t += TUNING.dt`, `state.tick += 1`, and the four input fields are copied onto `state.input` (what the HUD and the bot read back).
2. **The wind gusts** (`stepWind`): two Ornstein–Uhlenbeck steps — the gust factor and the veer — each fed one Box–Muller Gaussian, which is two uniform draws off `state.rng`. This runs in every phase and whether or not anything feels it, so a finished run and a calm one consume the same stream and a replay lands on the same numbers.
3. **The reset edge.** If `input.reset` is set and the run is `running`, `resetCraft` stands the craft behind the last gate it took (or the start) facing the next, at rest, emits `reset`, and the step RETURNS — neither the craft nor the course clock advances that step.
4. **The craft** (`stepCraft`, with the real input while `running` and `NEUTRAL_INPUT` once `finished`), in the physics' own order — the rider's mass lags toward the inputs; the probes are placed and `surfaceAt` is read under each; the water pushes back (`hullForces`: buoyancy, slam, skin friction, form drag, the keel's lateral bite, heave, the bow's lift, the dive's drag, the chine's bank, the strip-wise planing lift); the `planing` readout follows the lift's share of the weight; gravity on the two masses; the sponsons' bank-in; the engine and the nozzle step and the jet's reaction is applied at the transom; the little the keel turns with the throttle shut, and the carve; the water's rotational damping; the air (`windAt` at the craft's height, then `aeroForces`); the ground and the ramps (`contactForces`); the bounds' push; the integration (velocity first, position off the new velocity, the gyroscopic term kept, then the `maxSpin` / `maxSpeed` ceilings); the rocks as an impulse on the new pose (`clipSolids`, which is where `hit` is emitted); then the readings — heading/pitch/roll off the quaternion, `speed`, `wetted`, `submergedDepth`, `onRamp`, `onGround`, the cooldowns — and the flight bookkeeping that emits `launch`, `land`, `dive` and `ground`.
5. **The course** (`stepCourse`, with the position the step started from): the run clock advances (unless finished); the move is checked against the next gate and the one after it — a crossing of the next takes it, a crossing of the one after charges the skipped gate (`missedGate`, `TUNING.course.missedPenalty` = 5 s on the clock) and takes both; the last gate finishes the run (`finish`, phase → `finished`).

Nothing reads the frame rate. Nothing reads a wall clock. A step is `TUNING.dt` long, and the events say what happened in it.

### The state

`GameState` is one plain object, mutated in place by `step`:

| Field                        | What it holds                                                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `seed`, `rng`                | The run's seed and its owned stream.                                                                                                |
| `t`, `tick`                  | Sim time, s, and the step count — the only clocks.                                                                                  |
| `level`                      | The read-only `Level`: bounds, `ground` and `offshore` heightfields, the shore polyline, `materialAt`, solids, course, start, wind, water, hour. |
| `sea`, `wind`                | The wave field built once at `createGame`, and the gust state (`gust`, `veer` — the only mutable part of the weather).             |
| `craft`                      | `CraftState`: the spec; position, velocity, orientation quaternion, body angular rates; the derived `heading`/`pitch`/`roll`; `rpm`, `throttleEff`, `nozzle`; the rider's `riderAft`/`riderRight`; the readings (`wetted`, `airborne`, `airTime`, `planing`, `submergedDepth`, `speed`, `landing`, `onRamp`, `onGround`); and the bookkeeping the events need (cooldowns, `launchVy`, `dived`, `launchPending`). |
| `input`                      | The input the last step was given.                                                                                                  |
| `progress`                   | `nextGate`, `passed[]`, `missed[]`, `splits[]` (NaN until reached), `time` (penalties included), `penalty`, `finished`, `lastGatePassedAt`. |
| `phase`                      | `"running"` or `"finished"`.                                                                                                        |
| `events`                     | This step's `GameEvent[]`, cleared at the top of each step.                                                                         |

`CraftInput` is `{ steer, throttle, lean, reset }` — steer −1..1 with positive CLOCKWISE in map view, throttle 0..1 analogue, lean −1..1 with +1 the rider leaning BACK (nose up; in the air, the pitch control), and `reset` an edge. There is no brake, no handbrake, no gear. `NEUTRAL_INPUT` is all zeros.

### The events

Every event carries `t`. The renderer turns them into transient effects, the HUD's news column into lines, the simulator into counts:

| Kind         | When                                                                                               | Payload                              |
| ------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `gate`       | A water gate's line crossed the right way, in order.                                               | `gate`, `split`                      |
| `airGate`    | A ring passed through its disc.                                                                    | `gate`, `split`, `height`            |
| `missedGate` | The gate after the next one was taken first; the skipped one is charged and counted as reached.    | `gate`, `penalty`                    |
| `launch`     | The hull has been clear of everything for `flight.minAir` (0.2 s) after leaving with ≥ `flight.launchVy` (1.2 m/s) of climb. | `vy`, `speed`             |
| `land`       | The hull touched again after a flight at least `minAir` long.                                      | `vy` (the descent), `airTime`, `pitch`, `speed` |
| `dive`       | Within a second of a landing the bow is `flight.diveDepth` (0.55 m) under with the nose below `flight.divePitch` (−0.12 rad). Once per landing. | `depth`, `speed` |
| `hit`        | A solid met at ≥ `contact.hitSpeed` (1 m/s), at most every `contact.hitCooldown` (0.35 s).         | `solid`, `speed`                     |
| `ground`     | The keel on the ground, closing at > 0.4 m/s, at most every `contact.groundCooldown` (0.5 s).      | `speed`                              |
| `reset`      | The reset input was taken.                                                                         | `gate` (−1 for the start)            |
| `finish`     | The last gate was taken.                                                                           | `time`                               |

## `pwa/` — the browser shell

The app is a Vite + Preact + three.js site, phone-first, installable. It reads `GameState` and never mutates it — no rule lives here (§23.2), and `snapshot.ts` says so in its header: the speed is the engine's `speed`, the rev fraction is against the engine's own redline, the gate count is the engine's progress.

- **`main.tsx`** mounts **`App.tsx`** over the prerendered landing copy in `index.html`. The app boots the engine off the URL (`seed`, `craft`, `scene`, `t`, `shot` — [configuration.md](configuration.md)), runs the frame loop and mounts the renderer and the HUD. _As of this writing `App.tsx` is the bootstrap placeholder that draws the name and the build label; the real one lands with the vertical slice._
- **`game/run-loop.ts`** — the §37 accumulator, DOM-free: `createRunClock(TUNING.physicsHz)` is handed the frame's elapsed time and hands back how many whole steps to take. The frame delta is clamped to `MAX_FRAME_SECONDS` = 0.1 s — twelve steps — and **the time beyond it is dropped, never paid down**; a hidden tab **pauses the run**, clock included, and `resume` empties the accumulator so the first frame back is one frame long; `alpha` is the leftover fraction, offered to the renderer for interpolation and never read by the engine. The clamp is one constant, stated there and nowhere else.
- **`game/input.ts`** (the listeners) and **`game/input-model.ts`** (the maths, DOM-free): the key ramps, the handlebar and the throttle lever, and the ONE sign flip between the screen and the engine — `SCREEN_TO_ENGINE = −1`, because the renderer maps the engine's axes straight onto three.js's right-handed frame, whose view from behind the craft mirrors the map; `sampleInput` applies it to the steer, the wind vane applies it to a bearing, and nothing else may. **`game/thumb-guard.ts`** — every way a thumb zone's grip has to be able to END.
- **`game/snapshot.ts`** — what the HUD reads, taken off the state about twelve times a second (the canvas is the sixty-frame surface; the HUD is not). **`game/hud.tsx`**, **`hud-dial.tsx`**, **`hud-touch.tsx`** — the readouts and the two thumb zones. **`game/strings.ts`** — every word the player reads, in one table (§39.1); composed lines are templates.
- **`game/camera.ts`** — two rigs as maths: the low chase camera (the Wave Race read) and the nose camera.
- **`game/renderer.ts`** and its builders — **`water-mesh.ts`** (a grid following the craft whose vertices are displaced each frame by the engine's own `surfaceAt`, so what is drawn is what is simulated), **`terrain.ts`** (from `level.ground`, painted by `level.materialAt`), **`rocks.ts`**, **`gates.ts`** (buoys, rings, ramps), **`craft-body.ts`** + **`craft-styles.ts`** (one parametric low-poly hull from the spec's dimensions; the four share the builder). Lighting is a placeholder hemisphere + directional pair until the sky system exists.
- **`game/scenarios.ts`** — the eleven staged moments (`rest`, `cruise`, `carve`, `chop`, `swell`, `launch`, `apex`, `landing`, `dive`, `offshore`, `backflip`), each a `RunMoment` and a scripted input, DOM-free so the screenshot tool, the app's `?scene=` and the tests read the same list.
- **`identity.ts`** — name, copy, palette, URLs; **`app-pwa.ts`** + **`pwa-plugin.ts`** — the hand-rolled service worker and the one cache id they share; **`lib/pwa-update.ts`** — the prompt-to-update watch; **`shell-host.ts`** — the one file that knows a shell might exist; **`output-bridge.ts`** — the engine's output module routed into a 4000-line buffer (and onto the console in dev).
- **Placeholders**, each a header saying what will live there: `game/audio/` (every sound synthesized — nothing is a file), `sky.ts`, `minimap.ts`, `menu-main.tsx`, `settings.ts`, `campaign.ts`, `replay.ts`, `damage-fx.ts`, `rider.ts`, `fauna.ts`.

### The startup path is a budget

§23.9 asks for a named budget on the code needed to reach the first interactive screen, gated in CI. The budget is stated and gated in `scripts/check-seo.mjs`: the entry chunk plus every chunk it pulls in statically must stay under **1000 KB raw and 300 KB gzip**; `seo.yml` runs it on every push and PR and fails the build past either. When it trips, the fix is to find what reached onto the path — not to raise the number.

What the budget does NOT yet buy is §23.9's narrow entry surface: the game has no menu, so the first interactive screen IS the run, and the app imports `@engine` whole to stand one up. The day a menu needs one fact from the core (a level's name, a craft's blurb), that fact must come from an import-free leaf, or the menu's module graph will contain the whole simulation and every generator — an import is an import, and tree-shaking is global. The ledger ([spec-conformance.md](spec-conformance.md)) carries this as a partial.

## `tests/` and `scripts/`

`tests/` is the root vitest suite: one file per topic, `<topic>_test.ts`, node environment, no DOM. The physics suites stage the craft on the synthetic level in `tests/support/synthetic.ts` (a flat bed, a straight shore, a row of gates, one ramp, two skerries — nothing the generator built, so the rule suite is the §23.8 sequel test) and stand it at a moment with `placeRun`; the generator suites share one corpus of built levels through `tests/support/levels.ts`. Beside the physics, the suite holds the repository's own structure: the dependency direction, the file-size cap, the symlinks, the identity manifest, the changelog fragments, the skills, and the rule book's mirror in the docs.

`scripts/` is Node tooling under `--experimental-strip-types`, every tool parsing its flags through `scripts/lib/cli.mjs` (`--help`, a non-zero exit on an unknown flag): `simulate-run.mjs` (`make sim`), `level-map.mjs` (`make level`), `analyze-level.mjs` (`make analyze`), `waves-lab.mjs` (`make waves`), `ride-lab.mjs` (`make ride`), `screenshot.mjs` and `profile-render.mjs` (the two that drive the built site in Chromium), `generate-icons.mjs`, `check-seo.mjs`, `skill-lessons.mjs`, and `release/`. A script that needs an APP module (the scenario list, a style table) registers `aliasEngine` from `scripts/lib/engine-alias.mjs` before its `import()` so `@engine` resolves under plain Node.

## Deployment

The deployed site is the product. `pages.yml` builds three whole sites — `/` (the latest `v*` tag), `/preview/` (`main`), `/branch/` (a parked branch) — and serves them under one domain, each with its own manifest identity and service-worker scope; `release.yml` derives the version from the changeset fragments, writes `CHANGELOG.md`, tags, and chains into the deploy. [configuration.md](configuration.md) has the slots and the environment; [platforms.md](platforms.md) the shells reserved beside the web.
