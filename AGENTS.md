# Agent guidance for Sea Haven (game3)

This file is the canonical source of truth for AI coding agents working in this repo. `CLAUDE.md`, `.cursorrules`, `.windsurfrules`, `GEMINI.md`, and `.github/copilot-instructions.md` are symlinks to it (`tests/symlinks_test.ts` holds them).

**This file is the ROUTER, not the manual.** It says how work is done here, where things live at one level of detail, and which skill owns the rest. The procedures — every loop, every lab, every craft rule — live in `.agents/skills/`. Load the skill that owns the task's SUBJECT before starting; do not re-derive from this file what a skill already states.

This repository conforms to [`OSS_GAME_SPEC.md`](OSS_GAME_SPEC.md) — the committed copy IS the spec, self-contained, with no upstream document to fetch and no validator to call; it is a verbatim copy of the sibling rally game's, one spec for both games, and amending it is a reviewed PR that propagates the new mandate into the tree. When in doubt about layout, naming, or workflow conventions, the spec is the tie-breaker. Where the repo knowingly falls short of it, [`docs/spec-conformance.md`](docs/spec-conformance.md) is the ledger — one row per chapter, with the verdict, the evidence and what closing the gap would take; the `sync-game-spec` skill walks it.

**This repository is a VERTICAL SLICE.** The engine — the water, the wind, the craft, the course, the generator, the bot — is built and green. The app around it is the first playable cut: one taiga shore, one craft with its rider on the saddle, a chase camera, a full sky (the sun's place from the level's hour, five weathers, a cloud deck), a HUD with a minimap of the course in it, keyboard and touch, and the shell around all of it — an attract card, a front door with START and OPTIONS over a bot-ridden sea, a developer page behind a seven-second hold, and a loading card over a run being stood up. Everything else is a placeholder file with a header comment saying what will live there, and this file says so wherever it routes to one. Do not describe a placeholder as a feature, and do not build into one without loading `engine-system` first.

## Build and test commands

```sh
npm install       # everything resolves from the public npm registry
make build        # typecheck + production build (pwa/dist/)
make test         # vitest over the engine (SHARD=i/N slices it; CI runs four)
make lint         # eslint + typecheck, zero warnings
make fmt          # prettier in place; fmt-check is what CI runs
make hooks        # install pre-commit + commit-msg hooks
make icons        # regenerate icons/favicon/og.png from the app mark
make check-seo    # build + structural SEO/PWA/bundle-budget assertions
```

That is the everyday set. **The full list — every lab, what each one prints — is the README's Usage table, and the `Makefile` is the authority.** The table below says which of them a given change OWES.

**Scope the linter, never the typechecker, and leave the suite to CI.** `npx eslint <changed files>` is seconds where the whole repo is tens; `npx tsc --noEmit` must stay whole-program, because it checks a PROGRAM (naming files makes it ignore `tsconfig.json`) and because a changed signature breaks its CALLERS — the files you did not touch.

**`make fmt` is the Make target to run; `make test` is CI's.** The suite compiles whole levels, builds their sea and rides a craft through them at 120 Hz, and CI fans it out four ways on every push — so locally, run the FILES that cover the change (`npx vitest run tests/<topic>_test.ts`) and let the PR find the rest. The Make target is still the definition of green.

## The labs: what to run before and after which change

This project is tuned by measuring and LOOKING, not guessing. Each lab below is REQUIRED before and after a change in its subject — run it, keep both outputs, and put them in the PR. The owning skill says how to read what comes back.

| Change you are making                                   | Run                            | Owner                                          |
| ------------------------------------------------------- | ------------------------------ | ---------------------------------------------- |
| The wave model, the sea state, the gusts                | `waves`                        | `water-feel`                                   |
| The hull, planing, slamming, the pump, the lean, flight | `ride`                         | `craft-physics`                                |
| The catalog, roster balance                             | `sim`                          | `craft-tuning`, `simulate-run`                 |
| The bot rider                                           | `sim`                          | `bot-improvement`                              |
| The generator, its rules, the analyzer                  | `level`, `analyze`             | `mapgen-improvement`                           |
| A craft's look                                          | `crafts`, `screenshots SCENE=rest` | `craft-design`                             |
| The rider: his look, his pose, how he moves             | `crafts`, `screenshots`        | `rider`                                        |
| The sea life, the water's transparency                  | `level`, `screenshots SCENE=wildlife` | `nature`, `game-feel`                   |
| The HUD, the controls                                   | `screenshots`                  | `hud-and-menus`, `ui-review`                   |
| A menu, a setting, the splash or loading card           | `screenshots ARGS=--surface`   | `menu-system`, `ui-review`                     |
| The sky, the light, the weather                         | `sky`, `screenshots`           | `game-feel`                                    |
| Does it LOOK and READ right at speed                    | `screenshots`                  | `playtest`, `game-feel`                        |
| A contact, a gate, a reset                              | `ride`, `sim`                  | `collision`                                    |
| Anything rendered                                       | `profile`                      | `write-code`                                   |

`waves`, `ride`, `crafts`, `level` and `analyze` are pure Node — no build, no browser, seconds. `screenshots`, `profile` and `sky` are browser-driven. The first two drive the BUILT SITE, so **`make build` first, every time**: a stale dist photographs the last change rather than this one, and the picture that comes back is wrong in a way that reads as a bug in the code. `sky` builds its own one-off bundle from its harness page and so needs no `make build`. In Claude web sessions Chromium is preinstalled — prefix the browser-driven ones with `CHROMIUM_PATH=/opt/pw-browsers/chromium`.

Four of these are worth knowing about even when they are not your subject:

- **`make level SEED=38`** reasons about ONE level without riding it — every gate numbered with its offshore distance and the depth under it, every ramp, every rock, the wind arrow — in a couple of seconds. A claim about "the second air gate on seed 38" is a claim about a row there.
- **`make waves SEED=38`** is the sea with nothing riding it: a transect from the shore out, Hs against offshore distance, the spectrum. A wave-model change is judged by the sea it makes, and a screenshot shows one wave.
- **`make sim`** is CI's `simulate` job and exits non-zero when a craft finishes NO seed. Its digests are where a determinism regression shows first; `docs/simulation.md` says what every column means.
- **`make sky`** is every weather against every hour on ONE coast, as a single labelled sheet. It exists because a seed is dealt one sky (R19) at one hour (R13), so a screenshot of a RUN can only ever say whether that one sky is wrong — and the sky here is a LADDER, which is judged side by side or not at all.

## How work is done here

Rules that apply to every task, before any subject skill has a say. They are restated here from the skills that own them because a session that gets them wrong gets them wrong from its first tool call:

- **LOOK AT THE SIBLING REPO BEFORE BUILDING ANYTHING THAT IS NOT THE WATER.** [`niclaslindstedt/game2`](https://github.com/niclaslindstedt/game2) is the rally game this repo shares [`OSS_GAME_SPEC.md`](OSS_GAME_SPEC.md) with — same spec, same layering, same conventions, same commit and skill machinery — and it is **further along in nearly everything**. It has written skills where this repo only reserves the name (sound, soundtrack, atmosphere, visual effects, crashes, debug tools, level rating, platform shells, store listing and store shots), and a much deeper `scripts/` shelf: a sky lab, a track schematic, per-subject preview labs, tape record-and-replay, store preflight and shot sweeps. **Read its answer first and adapt it; do not reinvent one.** It is public, so a session reaches it read-only with `git clone --depth 1 https://github.com/niclaslindstedt/game2` (this repo cannot push there, and nothing in this tree may import from it — what comes across is the DESIGN, retyped in our vocabulary: a car is a craft, a stage is a shore, tarmac is water).
  - **What is ours alone, and where the sibling has no answer worth taking:** the sea (`water-feel`), the hull's reply to it (`craft-physics`, `craft-tuning`), the coast and what swims off it (`mapgen-improvement`, `nature`), the rider on the saddle. A rally game's grip model is not a planing hull, and a road is not a wave field — porting a shape from there into any of those is how this game stops being about water.
  - **What comes across nearly unchanged:** tooling and labs, the menu and shell furniture, the maintenance and release plumbing, store and platform work, and the procedure half of any skill. Adapting one of the sibling's skills is a real port — its subject must exist HERE first (this file's placeholder table is the list of subjects that do not), and it lands with its name and routing added to this file, `.agents/skills/README.md` and the `maintenance` registry, which `tests/skills_test.ts` holds.

- **Lint, typecheck and format ONCE, at the gate — not after every edit.** `make fmt` and `make lint` are the commit's gate (the `commit` skill owns the split). Re-running them between one edit and the next re-checks code nobody touched and tells you nothing; batch the whole coherent change, then check it. Mid-loop, if a specific answer is genuinely needed, check only the files you touched (`npx eslint <paths>`, `npx tsc --noEmit`) — never a whole-repo pass, and never `prettier`, whose every finding `make fmt` fixes at the end for free.
- **TEST WHAT YOU WROTE; THE PR TESTS THE REST.** Run the suites that cover the change and the ones it plausibly reaches, by file, and push — a red PR is a normal state and a follow-up commit costs nothing. Be honest about reach: a change to `TUNING`, `hull.ts`, `water.ts` or the generator reaches tests three directories away (a hull retune moves `craft_test`, `flight_test`, `simulation_test` and `determinism_test`'s digests at once; a rules change moves `mapgen_test`, `mapgen_population_test`, `analysis_test` and `docs_rules_test`), so name the topics generously for those; and a red PR is work NOW, not something to leave sitting.
- **THIS REPOSITORY IS PUBLIC — no personal details go in it.** Team ids, account names, tokens, keys, device ids, e-mail addresses, absolute paths under a home directory: none of them are committed, not even the ones that are identifiers rather than secrets, and not as a "default" a contributor can override. Everything of that kind is read from the ENVIRONMENT — a gitignored `.env` beside the tree that needs it (with the committed `.env.example` documenting the shape), and GitHub repository **secrets** for credentials or **variables** for identifiers on CI. The published app's own identifiers (`APP_NAME`, `SITE_URL`, `REPO_URL`) are the deliberate exception — they are the product's public name, and they live in `pwa/src/identity.ts`.
- **Every work session ends by committing its work with the `commit` skill.** Once the requested change and its gates are complete, load and follow that skill to make a conventional commit; when working in a worktree, follow its required sync step afterward.

## Commit and PR conventions

- Conventional commits (`feat(engine): …`, `fix(pwa): …`, `docs: …`); enforced by the `commit-msg` hook. Squash-merge: the PR title becomes the commit subject on `main`, so it must be a conventional subject too.
- Every user-visible change ships a changeset fragment in `.changes/unreleased/` (`<unix-ts>-<slug>.md` with `type:` front matter, `Added | Changed | Fixed | Removed | Security | Deprecated`), or the PR carries the `no-changelog` label. **Never edit CHANGELOG.md** — the release workflow writes it, and `tests/changeset_test.ts` holds both the fragments and the file's shape.
- Full workflow details: [CONTRIBUTING.md](CONTRIBUTING.md).

## Architecture summary

Three layers, one direction of dependency (details: [docs/architecture.md](docs/architecture.md); enforced by `tests/imports_test.ts`):

- **`engine/`** — the whole game as a framework-free, renderer-free TypeScript module that imports NOTHING but itself. Fixed 120 Hz `step(state, input)` (`TUNING.physicsHz`; the bot decides on every step too), deterministic per seed (no `Math.random` at runtime — everything draws from the seeded RNG in state, `state.rng`). Contains the sea and the wind (`game/water.ts`, `wind.ts` — pure functions of `(x, z, t)` plus one seeded gust process), the craft (`game/craft.ts` summing `hull.ts`, `hydro.ts`, `propulsion.ts`, `flight.ts`, `collision.ts`), the course (`game/course.ts`), the level generator (`mapgen/`), the bot rider + headless simulator (`sim/`), the generator's scoreboard (`analysis/` — dev-time only, but it IS the generator's accept gate), the §19.4 output module (`output.ts`), and data-authored content (`game/defs/`). `engine/index.ts` is the one public surface; `@engine` is how every host spells it.
- **`pwa/`** — the browser shell: Preact app, three.js renderer (reads `GameState`, never steps physics — and displaces its water mesh by calling the engine's own `surfaceAt`, so what is drawn is what is simulated), input, HUD, PWA plumbing (hand-rolled service worker via `pwa-plugin.ts` + the update watch in `lib/pwa-update.ts`). No audio yet (`game/audio/` is a placeholder — when it comes, nothing is a file).
- **`tests/` + `scripts/`** — root-level vitest suites over the engine, and Node tooling (the sim CLI, the level map, the waves and ride labs, screenshots, icons, SEO checks, release plumbing; every tool parses its flags through `scripts/lib/cli.mjs`, which gives it `--help` and a non-zero exit on an unknown flag).

Beside them, OUTSIDE the npm workspace and outside the root suite's path, the two shells that will wrap the built site — **`tauri/`** (the desktop app) and **`native/`** (the App Store / Play Store app) — are today ONE README EACH, saying what the tree will be. **Nothing in `engine/` may learn either exists, and the ONE line of `pwa/` that does is `pwa/src/shell-host.ts`** (the frozen `__SH_SHELL__` global). A feature a shell needs is a feature the website needs first.

**Hard rules:** the engine never imports three.js, Preact, `node:` or anything from `pwa/` or `scripts/` (framework-free, and the test says so); the renderer never mutates `GameState`; engine randomness only via `state.rng` (`tests/determinism_test.ts` + `tests/imports_test.ts` enforce it — and the wind draws its gusts off `state.rng` every step whether or not anything feels them, so a run replays the same stream); source files stay under 1000 lines (`tests/file_size_test.ts`, §20.5's marker for the honest exceptions); the engine prints only through `engine/output.ts`. **The game ships no asset files** — every hull, every wave and every shore is code.

### The role map, and what is generated

The spec (§23) names roles, not directories; this is the mapping, and the arrows are rules a review may refuse a change against. `engine/` is the **simulation core** (§23.1) with `engine/index.ts` as its one public entry surface; `pwa/` is the **presentation shell** (§23.2); `tauri/` and `native/` are **platform shells** (§23.3, placeholders); `scripts/` is **tooling** (§23.6) and may import anything while nothing imports it. There is no session service — the game is single-player (§34 does not apply). The core imports nothing from a shell or a script; a shell imports the core, never another shell; the suite reaches the core through `@engine` like a host does.

**Content (§23.5) is the deliberate deviation**: this game's levels are GENERATED from a seed rather than authored, and its small fixed catalogs (`engine/game/defs/craft.ts`, `tuning.ts`; `mapgen/biomes.ts`, `mapgen/rules.ts`) are TypeScript consts rather than schema-validated data files. `docs/spec-conformance.md` carries the reasoning, mirrored from the sibling repo's, and what changing it would cost — do not start converting a catalog to data on the strength of §24 alone.

What IS generated is generated, and **a generated artifact is never hand-edited**:

| Artifact                                                 | Regenerated by                | Guard                                           |
| -------------------------------------------------------- | ----------------------------- | ----------------------------------------------- |
| `pwa/dist/` (the site, the service worker, its manifest) | `make build`                  | `make check-seo` (`seo.yml`)                    |
| Icons, favicon, `og.png`                                 | `make icons`                  | `tests/app_mark_test.ts` holds the SVG to `app-mark.ts`; `tests/identity_test.ts` the palette |
| Every lab picture under `previews/`                      | its lab target (labs table)   | gitignored                                      |
| `CHANGELOG.md`                                           | the release workflow          | `tests/changeset_test.ts`, the pre-commit hook  |
| `engine/version.ts` + the `package.json` versions        | `scripts/update-versions.sh`  | the release workflow                            |

## Where new code goes

By area first. Each row's skill owns the file-by-file map inside that area — go there rather than guessing from a directory name.

| Area                                                  | Lives in                                                      | Skill                |
| ----------------------------------------------------- | ------------------------------------------------------------- | -------------------- |
| The sea: the wave field, its spectrum, the gusts      | `engine/game/water.ts`, `wind.ts`, `TUNING.sea` / `.wind`     | `water-feel`         |
| What the wind crossed to get here: fetch, exposure, shelter | `engine/game/fetch.ts`                                  | `water-feel`         |
| The river's current, and what it drifts (R27)        | `engine/mapgen/flow.ts`, `river.ts`, `R.flow`                 | `water-feel`, `mapgen-improvement` |
| The hull in the water, planing, slamming, the dive    | `engine/game/hull.ts`, `hydro.ts`, `craft.ts`                 | `craft-physics`      |
| The pump, the nozzle, the engine                      | `engine/game/propulsion.ts`, `TUNING.pump`                    | `craft-physics`      |
| Flight, the air, the rider's authority                | `engine/game/flight.ts`, `TUNING.flight`                      | `craft-physics`      |
| What separates one craft from another                 | `engine/game/defs/craft.ts`                                   | `craft-tuning`       |
| Hitting things: rocks, the ground, ramps, the bounds  | `engine/game/collision.ts`, `TUNING.contact`                  | `collision`          |
| Gates, splits, the miss, the reset, the finish        | `engine/game/course.ts`, `TUNING.course`                      | `collision`          |
| The level generator and its ground                    | `engine/mapgen/`                                              | `mapgen-improvement` |
| How a level is scored for DEFECTS                     | `engine/analysis/`                                            | `mapgen-improvement` |
| The bot rider                                         | `engine/sim/bot.ts`                                           | `bot-improvement`    |
| Measuring balance                                     | `engine/sim/simulate.ts`, `scripts/simulate-run.mjs`          | `simulate-run`       |
| A whole new gameplay system                           | engine first, then `pwa/`                                     | `engine-system`      |
| How a craft looks                                     | `pwa/src/game/craft-body.ts`, `craft-styles.ts`               | `craft-design`       |
| The rider on the saddle: the pose, the figure         | `pwa/src/game/rider-pose.ts`, `rider.ts`                      | `rider`              |
| The camera                                            | `pwa/src/game/camera.ts`                                      | `game-feel`          |
| The sky: the sun's place, the ladder of looks, the lid | `pwa/src/game/sky.ts`, `sky-rungs.ts`, `sky-looks.ts`, `daylight.ts` | `game-feel`   |
| The sky as DRAWN: the dome, the stars, the clouds     | `pwa/src/game/environment.ts`, `sky-dome.ts`, `clouds.ts`     | `game-feel`          |
| Which sky a seed is ridden under (R19)                | `engine/mapgen/weather.ts`, `biomes.ts`'s `weathers`          | `mapgen-improvement` |
| HUD, the dial, touch and keys, input                  | `pwa/src/game/hud*.tsx`, `input.ts`, `input-model.ts`         | `hud-and-menus`      |
| The frame rate the HUD's corner reads                 | `pwa/src/game/frame-rate.ts`                                  | `hud-and-menus`      |
| The splash, the main menu, options, the developer page | `pwa/src/game/menu*.ts*`, `splash*.ts*`, `loading-screen.tsx` | `menu-system`       |
| The start card: shore, time, wind, weather, then the craft | `pwa/src/game/menu-start.tsx`                                | `menu-system`       |
| The craft card: the hull on a turntable, its spec sheet, then RIDE | `pwa/src/game/menu-craft.tsx`, `craft-picker.tsx`, `craft-turntable.ts`, `craft-stats.ts` | `menu-system`, `craft-design` |
| The seed's chart and the day it deals, and the worker that builds both | `pwa/src/game/seed-preview.tsx`, `seed-preview-worker.ts` | `menu-system`   |
| What the game REMEMBERS between visits                | `pwa/src/game/settings.ts`                                    | `menu-system`        |
| What the PICTURE costs: the video rows and their ladders | `pwa/src/game/settings-video.ts`, `renderer.ts`'s `setVideo` | `menu-system`, `game-feel` |
| Standing a run up behind a card                       | `pwa/src/game/run-loader.ts` + the steps in `App.tsx`          | `menu-system`        |
| The minimap: the coast it cuts, what stands on it     | `pwa/src/game/minimap-scene.ts`, `minimap-view.ts`, `minimap.tsx` | `hud-and-menus`   |
| The water as DRAWN, the terrain, the rocks            | `pwa/src/game/water-mesh.ts`, `terrain.ts`, `rocks.ts`        | `nature`, `water-feel` |
| What a COAST's water looks like: its tones, its clarity | `pwa/src/game/water-optics.ts`                              | `nature`, `game-feel` |
| The water as LIT: the glint, the reflected sky, the ripples, the foam's texture | `pwa/src/game/water-shader.ts`                       | `game-feel`, `water-feel` |
| The spray, the wake, the foam a landing leaves        | `pwa/src/game/spray.ts`, `wake.ts`, `fx-textures.ts`          | `game-feel`            |
| The biomes, the shore's materials                     | `engine/mapgen/biomes.ts`, `geology.ts`, `shore.ts`           | `nature`             |
| What swims here: the catalog, its rarity (R20)        | `engine/game/defs/fauna.ts`, `mapgen/fauna.ts`, `biomes.ts`'s `fauna` | `nature`     |
| Where an animal IS at a moment                        | `engine/game/fauna.ts` (`faunaPose`)                          | `nature`             |
| The sea life as DRAWN, seen through the water         | `pwa/src/game/fauna.ts`, `water-mesh.ts`'s alpha              | `nature`, `game-feel` |
| The buoys, the rings, the ramps as drawn              | `pwa/src/game/gates.ts`                                       | `collision`          |
| A staged moment                                       | `pwa/src/game/scenarios.ts`, `engine/game/place.ts`           | `test-scenario`      |

**The placeholders** — each a file with a header saying what will live there. Nothing routes here yet; the skills that WILL own them are reserved by name in `.agents/skills/README.md` and do not exist. Building one starts with `engine-system` (engine half first) and, for anything drawn, `game-feel`.

| Waiting for                                   | The file(s) waiting                                              |
| --------------------------------------------- | ---------------------------------------------------------------- |
| Every sound and every note (synthesized, no files) | `pwa/src/game/audio/index.ts`                                |
| Damage: what a hit costs the machinery        | `engine/game/damage.ts`, `pwa/src/game/damage-fx.ts`             |
| Trick scoring (the backflip is reachable, unscored) | `engine/game/tricks.ts`                                    |
| The campaign, its modes, which seeds          | `pwa/src/game/campaign.ts`, `engine/rating/index.ts`             |
| A run recorded and watched again              | `engine/sim/tape.ts`, `pwa/src/game/replay.ts`                   |
| The desktop app, the store app                | `tauri/README.md`, `native/README.md`                            |

And the pieces that belong to no skill in particular:

| Kind of change                                     | Where it goes                                                                                              |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Run orchestration (create, step, phase, events)    | `engine/game/step.ts`                                                                                      |
| The state shape and the events                     | `engine/game/state.ts` — only `craft.ts`, `collision.ts`, `course.ts` and `step.ts` write it during a run (`place.ts` stands one at a moment)              |
| A number that shapes the FEEL, shared by every craft | `engine/game/defs/tuning.ts` — every number carries its unit; the model it feeds cites its source          |
| Level geometry / compilation                       | `engine/mapgen/compile.ts` (bakes the two heightfields ONCE; nothing downstream regenerates any of it)      |
| A generic grid, a quaternion, noise, the PRNG      | `engine/lib/` — the generic pool, nothing of THIS game in it (§23.7 rule 5)                                |
| The app's frame loop (the §37 accumulator)         | `pwa/src/game/run-loop.ts` — the clamp is one constant beside the step rate, stated nowhere else            |
| Anything drawn, with no better home                | `pwa/src/game/renderer.ts`                                                                                 |
| The app mark, wherever the app draws one           | `pwa/src/game/app-mark.ts` (the wave's two paths as data)                                                  |
| App identity (name, palette, URLs)                 | `pwa/src/identity.ts` — the single source; `tests/identity_test.ts` holds every restatement to it          |
| A Node script needing an app module                | `aliasEngine` in `scripts/lib/engine-alias.mjs` before the `import()` — never a Vite build to read a table |
| New CLI tooling                                    | `scripts/*.mjs` (Node, `--experimental-strip-types`, flags through `scripts/lib/cli.mjs`)                   |
| A lab that has to DRAW to answer its question      | a harness page in `pwa/src/tools/` + its own `pwa/<name>-preview.html`, driven by `scripts/<name>-preview.mjs` — the sibling repo's pattern; vite builds only `index.html`, so a harness never ships |
| Engine tests                                       | `tests/<topic>_test.ts`                                                                                    |

### Stated once — never restate these

Each of these is the one place an answer is written down. Anything that needs it ASKS; a second copy is a bug the day one of them moves.

- **What a craft CAN do** — `engine/game/limits.ts` (`maxRpm`, `maxNozzle`, `MAX_LEAN`, `jetCeiling`, `airPitchTorque`, `topSpeedOf`), read by the physics AND `sim/bot.ts`. Never restate a ceiling.
- **What the speedo reads** — `CraftState.speed`: `|v|`, vertical included, written once at the end of `stepCraft`. The HUD, the bot and the sim all read it and none restates it.
- **Where an animal is** — `faunaPose(pod, i, t, out)` in `engine/game/fauna.ts`: the sea life's `surfaceAt`, a pure function of the pod's loop and the clock. Nothing about the fauna is stepped, stored per frame or replayed, and `pwa/src/game/fauna.ts` reads this and nothing else.
- **The wave surface** — `surfaceAt(sea, level, x, z, t)` in `engine/game/water.ts`: the height, the normal and the water's velocity — the waves' orbital motion AND the river's current (R27), because "how fast is the water going here" is one question. The hull probes call it at 120 Hz and the renderer's `water-mesh.ts` calls the SAME function to displace its vertices. There is no second wave function anywhere.
- **What the wind crossed to get here** — `createShelter(level, wind)` in `engine/game/fetch.ts`: the effective fetch, the exposure to the open sea and the shelter over the plan, measured ONCE per run and read by both the sea (R28's two bands) and the wind. Nothing else decides whether a piece of water is the ocean's or a river's.
- **What the shore is made of** — `Level.materialAt(x, z)`; the sea's `surfaceAt` is the WAVE surface, which is why the level's classifier is not called that.
- **The ramp's anchor** — `rampSurface` in `engine/mapgen/course.ts`: `(x, z)` is the HINGE at the waterline, `length` is the plan footprint, the lip stands `length · tan(angle)` up. The collision engine's `rampDeckY` is the same line, and the search, the analysis and the tests all place a ring off it (`ringPlacement`).
- **Where a reset stands the craft** — `resetPose` in `engine/game/course.ts`; `standCraft` is how anything puts a craft down afloat at its rest draft (`restY` in `hull.ts` — Archimedes, bisected).
- **The heading to the next gate** — `bearingToNext` in `engine/game/course.ts`, for the HUD's arrow and the bot alike.
- **How far down the course a run has got** — `gatesReached` in `engine/game/course.ts`: gates taken plus gates charged for. The HUD's `n / N` counter and the minimap's gauge are the same reading in two forms, and neither restates the sum.
- **The sign conventions** — heading 0 = +z, clockwise from above; pitch NOSE-UP positive; roll RIGHT-SIDE-DOWN positive; body angular rates right-handed. `engine/lib/quat.ts`'s `fromEuler`/`toEuler` own the flip between the rider's reading and the algebra's. The one place the SCREEN's axes (thumb toward you, drag down for throttle) are turned into the engine's signs is `pwa/src/game/input-model.ts`, DOM-free so the tests can read it; `input.ts` only feeds it events.
- **What sky a level is under** — `Level.weather` (R19) and `Level.hour`, with `skyCover(wind.speed)` the one measure of how heavy that sky is. `pwa/src/game/sky.ts`'s `skyAt` turns the three into a `Preset`, and everything that answers to the sky — the two lights, the fog, the dome, the clouds, what the water reflects — reads that ONE preset. Nothing anywhere else decides how dark it is.
- **What the water reflects** — `seaReflection(preset)` (the sky as a gradient a wave face can point into, and how much sun there is to glint) and `seaMirror(preset)` (the same at the one grazing angle the horizon ring has); `water-mesh.ts` is handed the preset and the scene's two lights (`retone`) and never picks a sky colour or a light of its own, and `fauna.ts` is handed the same preset for the colour a depth hazes an animal toward. The open sky's gradient itself is `skyToneAt` in `sky.ts`, which the dome paints with and the water's GLSL restates from the same three constants (`SKY_CURVE`, `GLOW_FOCUS`, `GLOW_REACH`).
- **WHAT A COAST'S WATER IS MADE OF** — `waterOpticsOf(level.biome)` in `pwa/src/game/water-optics.ts`: the three tones and the depths they run over, the surface's window, the flat unlit tone the bottom fades into, and `clarity` — how far the eye gets into that water. `clarity` is the ONE depth scale the whole see-through model is written against: the window reaches its deep stop over it (`water-mesh.ts`), the sea bed fades into the bed tone over it (`terrain.ts`), and an animal hazes toward the water over it (`fauna.ts`). Nothing restates a water colour or a depth of its own, and the surface's alpha is never the thing that hides the bottom — it is one number for a patch of sea and cannot tell a fish at two metres from a bed at twenty.
- **How far a rider can see INTO the water** — `WaterMesh.seeThrough()` in `pwa/src/game/water-mesh.ts`: inside that radius the near grid is semi-transparent and the horizon ring has its hole; outside it the far water is opaque. Anything drawn under the surface is drawn only inside it, and asks the mesh rather than recomputing it — the radius moves with the WATER row and is 0 when the rider has closed the window, so one number carries both the reach and the setting.
- **WHAT THE GAME REMEMBERS** — `pwa/src/game/settings.ts`, and `mergeSettings` is the one place a stored blob is turned into settings this build offers. Nothing else reads storage, and no surface keeps a preference of its own beside it.
- **WHAT A PICTURE ROW COSTS** — `pwa/src/game/settings-video.ts`: the dictionary between a row of OPTIONS ▸ VIDEO and the numbers the renderer needs (the water grid's three dimensions, the ripple reach, the anisotropy, the pixel share, the spray budget, the flora share). DOM-free, so `tests/video_test.ts` reads the whole ladder; `renderer.setVideo` is the one place a row becomes a draw call.
- **WHICH SURFACE IS UP** — `Shell` in `pwa/src/App.tsx` (`splash | menu | loading | run`), and ONE engine state carries through all four: the shell only decides who rides it (`botInput` under a card, the input manager under a run) and what is drawn over it. Nothing anywhere else decides whether the game is running — it always is.
- **The ONE clock** — `state.t` advances by `TUNING.dt` per step and is the only time the engine knows; the sea is a function of it. Nothing in `engine/` reads a wall clock (`analyzeLevel`'s report timer is the recorded exception, dev-time only).

## Test conventions

- Tests live in the root `tests/` directory, one file per topic, named `<topic>_test.ts` (OSS_GAME_SPEC §20.2).
- Runner: vitest via `make test`; config in `vitest.config.ts` (alias `@engine` → `engine/index.ts`, `testTimeout` 120 s because a case builds whole levels). No DOM, no browser — engine tests, plus the DOM-free app modules (`input-model.ts`, `scenarios.ts`, `identity.ts`).
- **Physics tests stage the craft on the SYNTHETIC level** in `tests/support/synthetic.ts` — a flat bed, a straight shore, a row of gates, one ramp, two skerries, nothing the generator built — and stand it at a moment with `placeRun` (`engine/game/place.ts`), then script inputs step by step. That is the §23.8 sequel test kept honest: the rule suite passes with the generator deleted. The `test-scenario` skill owns staging an exact situation.
- **A file that asserts a dozen rules over the same spread of seeds takes its levels from `tests/support/levels.ts`** (`LEVEL_SEEDS`, `levelFor`, `analysisFor`) rather than generating them per `it`. Generating a level is the most expensive thing the engine does (a coast, a course, the rocks, two baked grids, an analysis, and again for every rejected sub-seed) and it is deterministic, so the second build can only return the first one's answer. What comes back is SHARED and read-only; a test that breaks a level on purpose copies it first, and a determinism check that needs two independent builds calls the engine directly.
- **Sharding splits at FILE granularity, so the slowest single file is the floor under `make test` on CI.** Four shards is where a suite this size flattens. Keep a file under a minute: share the corpus, and split a file whose subject is really two (`mapgen_test` / `mapgen_population_test`).
- **The governance tests are tests too**, and they run in the same suite: `imports_test` (the dependency direction, §23.7), `file_size_test` (§20.5), `symlinks_test` (§7.1, §21.2), `identity_test` (§35.6), `changeset_test` (§8.5), `skills_test` (§21), `docs_rules_test` (the rule book's mirror), `determinism_test` (§25). A structural rule this file states and no test holds is a rule that will not survive a deadline.
- **Running them:** `make test` is the whole suite (`SHARD=i/N` runs one slice); `npx vitest run tests/<topic>_test.ts` runs one file, which is what you run locally.
- No extra test dependencies; everything runs on plain Node.

## Documentation sync points

| When this changes                            | Update this                                                                                           |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| The wave model, the wind (`water.ts`, `wind.ts`, `TUNING.sea`/`.wind`) | `docs/water.md`, then `make waves`                                          |
| The hull, the pump, flight, the contacts, the catalog | `docs/riding.md`, then `make ride` and `make sim`                                            |
| Generator rules (`mapgen/rules.ts`)          | `docs/level-generator.md` (the R-rules VERBATIM — `tests/docs_rules_test.ts` holds it), `examples/seeds.md` |
| Bot, sim harness, the `RunReport`, the sim CLI | `docs/simulation.md`                                                                                |
| The layers, the step order, the state shape  | `docs/architecture.md`                                                                                |
| Commands / npm scripts / Make targets        | README Usage table + this file's labs table                                                           |
| The URL parameters, the deploy slots         | `docs/configuration.md`; `App.tsx`'s URL readers and `scripts/screenshot.mjs` move together           |
| A menu surface, a setting, the shell's flow  | `docs/getting-started.md`, `docs/configuration.md` (the `?menu=` and `?start=` readers)               |
| App identity, domain, deploy slots           | `identity.ts`, README, `docs/configuration.md`, `pwa/public/*`, `pwa/index.html`                      |
| The craft, the controls, install flow        | README (What/Controls) + `docs/getting-started.md`                                                    |
| Shell/platform plans                         | `docs/platforms.md`, `tauri/README.md`, `native/README.md`                                            |
| A spec chapter, or a verdict under one       | `docs/spec-conformance.md` — `sync-game-spec` re-dates it                                             |
| A skill added, renamed or retired            | this file's Skills section, `.agents/skills/README.md`, the `maintenance` registry for an `update-*` — `tests/skills_test.ts` holds all three |

## Parity and cross-cutting rules

Places where one idea is deliberately written in two files that cannot import each other. Each is a live trap: change one, change both.

- `pwa/src/identity.ts` is the identity source of truth; `pwa/public/icons/icon.svg`, `scripts/generate-icons.mjs` and `pwa/src/game/app-mark.ts` encode the same mark geometry (the wave's two arcs) and the same palette hexes. None can import either of the others, so change one and change all three, then `make icons`. `tests/identity_test.ts` holds the generator's palette to `PALETTE`, and `tests/app_mark_test.ts` holds the SVG's two paths and stroke width to `app-mark.ts`.
- `pwa/index.html` restates the name, the URLs, the description and `PALETTE.sea` (a static head cannot import); `pwa/public/{CNAME,robots.txt,sitemap.xml,llms.txt}` restate the domain. `tests/identity_test.ts` holds every one of them.
- The service worker contract (the cache id, the emitted files) is shared between `pwa/pwa-plugin.ts` and `pwa/src/app-pwa.ts` (`cacheIdForBase`) — keep them agreeing.
- **The rule book has a mirror.** `engine/mapgen/rules.ts` states every R-rule once in its header; `docs/level-generator.md` carries the same prose VERBATIM. `tests/docs_rules_test.ts` reads the ids off the code, so a new rule fails the test until its mirror lands.
- **The fauna is named twice.** `engine/game/defs/fauna.ts` carries what an animal IS (its length, its speed, how rare it is) and `pwa/src/game/fauna.ts`'s `STYLES` carries what it LOOKS like (its paint, its fins, its markings) — the craft's `defs/craft.ts` / `craft-styles.ts` split, and the same trap: a species added to one and not the other does not compile, but a species whose proportions disagree between them draws wrong and nothing says so.
- **A coast is named twice.** `engine/mapgen/biomes.ts` carries what a coast IS (its stone, its relief, its water's density and temperature, its skies, its sea life) and `pwa/src/game/water-optics.ts` carries what its WATER LOOKS like (its tones, its ramp, its window, its clarity, its bottom) — the `defs/fauna.ts` / `STYLES` split, for the same reason: nothing in the engine has an opinion about colour. Neither can import the other, so a coast added to `BIOMES` and not to `WATER_OPTICS` throws on its first level; `tests/water_optics_test.ts` holds the two lists to each other.
- **The staged moments are named twice.** `pwa/src/game/scenarios.ts` (the app, `?scene=`, the screenshot tool) and the ride lab's list in `scripts/lib/ride-scenarios.mjs` both name them; a scenario added to one and not the other is a lab that cannot draw what the app can stand in, or the reverse. Change one, change both — or fold the lab onto the app's list through `aliasEngine`.
- **The sky is authored in linear light and drawn in three.js.** `pwa/src/game/sky.ts` is deliberately three-free so the tests can read the whole colour model, and every mix in it goes through `pwa/src/lib/colour.ts`, which converts sRGB→linear→sRGB exactly the way `THREE.Color.lerp` does with colour management on. A mix added in the sky against a different curve drifts from every material the same preset lights.
- **The ramp is one line in two engines.** `rampSurface` (`mapgen/course.ts`) and `rampDeckY` (`game/collision.ts`) compute the same deck height from the same hinge; `tests/collision_test.ts` rides one and `tests/mapgen_test.ts` places rings off the other.
- **The shell global `__SH_SHELL__`** is stated in `pwa/src/shell-host.ts` and will be restated by each shell's initialization script, which cannot import it — `platform-shells`'s trap, reserved.
- The deployed site IS the product (§11.2-as-webapp): there is no separate `website/` tree. SEO copy lives in `pwa/index.html` + `pwa/public/`; keep it in sync with `identity.ts`, and treat a stale deployed site after identity/feature changes as a bug (`update-website` owns the sweep).
- The engine's determinism is a contract three suites hold from three sides — `determinism_test` (a run replays), `simulation_test` (the digest), `imports_test` (no clock, no `Math.random`, nothing external) — and the wind consumes its randomness whether or not anything feels it, so adding a draw anywhere in `step` changes every digest: say so in the PR.

## Skills

Skills live in `.agents/skills/` (`.claude/skills` and `.gemini/skills` symlink there) — each a `SKILL.md` playbook with an empty `.lessons/` directory `skill-reflection` fills. Load the one that owns the task's SUBJECT, plus the workflow ones its steps name. This file is the router; the procedures live in the skills. `tests/skills_test.ts` holds this list to the directory.

**Session workflow** (every task):

- **`start-work`** — the preflight: clean tree, sync with `origin/main`, the deliver-by-default contract.
- **`write-code`** — how code is written here: comments and the comment-pruning pass, the edit loop, the 1000-line cap, test conventions, the generic pools and aliases. Load beside the subject skill on any code change.
- **`skill-reflection`** — read each loaded skill's lessons at the start (`node scripts/skill-lessons.mjs <skill>`), record/prune/promote at the end.
- **`changelog`** → **`commit`** — the fragment-or-label call, then gates, push, PR. **`conflict`** whenever a branch moves onto another.

**Craft** (the subject owners):

- **`game-feel`** — how the game FEELS: the hull meeting a wave, the reference (Wave Race 64 with a modern look), the camera, the cross-system levers. Load it whenever the acceptance test is "does it feel right".
- **`water-feel`** — the sea: the Gerstner sum, the JONSWAP / Pierson–Moskowitz spectrum, dispersion, shoaling, breaking, the fetch law and the exposure that decides whether a point is dealt the ocean's sea or a river's chop (R28), the river's current (R27), the gusts and the shelter field; `make waves`.
- **`craft-physics`** — the hull's answer to the water: the probes and the draft, the drags, Savitsky's planing lift, the slam and the dive, the waterjet and the nozzle, the lean, flight; `make ride`.
- **`craft-tuning`** — what separates the skiff, the marlin, the otter and the dart; the catalog and its derived expectations; the roster read off `make sim`.
- **`craft-design`** — how a craft LOOKS: the parametric builder, the styles, the `SCENE=rest` contact sheet.
- **`rider`** — the man on the saddle: the pose from the cockpit and the engine's readings, the body on springs, the figure; judged from behind on the sheet and at chase range.
- **`collision`** — the hull meeting what is not water: solids, grounding, ramps, gates and misses, the bounds; what each event means.
- **`engine-system`** — adding or changing a gameplay system, engine-first.
- **`mapgen-improvement`** — the shore generator (rules / search / geometry, the R-rules), the analyze → fix → `make level` loop.
- **`nature`** — the shore's materials as biome-as-data, what `terrain.ts` paints, the rocks, and the sea life under the water (R20: the catalog and its rarity, the placer, the swim model, the look); later the flora.
- **`hud-and-menus`** — the HUD's readouts, the handlebar and the throttle lever, the keys — what is drawn over a RUN.
- **`menu-system`** — the shell around a run: the attract card, the front door, the start card and the craft card after it, options, the developer page behind the seven-second hold, the loading card, and the settings they read and write.
- **`ui-review`** — the fit-and-finish sweep at the reference viewports (1280×720, 390×844).
- **`playtest`** — staged moments photographed in the built app: `make screenshots SCENE=`.
- **`test-scenario`** — exact situations: the synthetic level, `placeRun`, scripted inputs, `scenarios.ts` read three ways.
- **`debug-game`** — deterministic repros, classifying by layer, the failing test first.
- **`simulate-run`** — `make sim`: the `RunReport` table, its columns, which movements are regressions.
- **`bot-improvement`** — the gate-aiming bot in `engine/sim/bot.ts`, kept minimal, measured with `make sim`.

**Maintenance** (each with a `.last-updated` baseline):

- **`maintenance`** — the umbrella: dispatches every `update-*` skill in registry order after big merges or on a cadence.
- **`update-docs`** / **`update-readme`** / **`update-website`** / **`update-prompts`** — re-sync `docs/*.md`, README.md, the SEO/identity shell, and `prompts/` (dormant) against their sources of truth.
- **`sync-game-spec`** — walk OSS_GAME_SPEC.md chapter by chapter against the repo, offline, and re-date `docs/spec-conformance.md`; the closing step of a full sweep.

Run the specific skill when you know what drifted; run `maintenance` when you don't.

**Reserved, not written** (see `.agents/skills/README.md`): sound-effects, soundtrack, atmosphere, visual-effects, wipeout, damage, tricks, craft-creation, built-shore, fauna, level-rating, campaign, replay, debug-tools, platform-shells, store-listing, store-shots. A lesson about one of those subjects waits, scoped, in the nearest existing skill until its subject is built.
