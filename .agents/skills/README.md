# Agent skills

Every skill is a `SKILL.md` playbook under `.agents/skills/<name>/`, with
the §21.3 front matter and structure, an empty `.lessons/` directory the
`skill-reflection` skill fills, and — for the maintenance skills — a
`.last-updated` baseline (§21.4). `.claude/skills` and `.gemini/skills` are
symlinks here. `AGENTS.md` is the router that says which one to load;
`OSS_GAME_SPEC.md` §21 is the contract they are written to.

## Session workflow

| Skill | One line |
| --- | --- |
| `start-work` | The preflight: clean tree, sync with `origin/main`, the deliver-by-default contract |
| `write-code` | How code is written here: comments and the pruning pass, the edit loop, the 1000-line cap, tests, the generic pools |
| `commit` | Gates by cost, the commit, the push and the PR as one step, the sim-table obligation |
| `changelog` | The fragment-or-`no-changelog` call every PR owes |
| `conflict` | Moving a branch onto another: the backup branch, always fetch, resolve honestly |
| `skill-reflection` | Read each loaded skill's lessons first; record, prune, merge, promote at the end; the size bars; `scripts/skill-lessons.mjs` |

## Maintenance (§21.5, §21.6)

| Skill | One line |
| --- | --- |
| `maintenance` | The umbrella: the registry of every `update-*` skill and the order they run in |
| `update-docs` | `docs/*.md` back in step with the water, the craft, the generator, the sim and the tooling |
| `update-readme` | `README.md`'s twelve sections back in step with the commands, the craft and the controls |
| `update-website` | The identity-derived shell and the SEO files under `pwa/` back in step with `identity.ts` |
| `update-prompts` | `prompts/` back in step with its sources (dormant — no prompt shipped yet) |
| `sync-game-spec` | Walk `OSS_GAME_SPEC.md` chapter by chapter against the tree; re-date `docs/spec-conformance.md` |

## Craft (§21.9)

| Skill | One line |
| --- | --- |
| `game-feel` | How the game FEELS: the hull meeting a wave, the reference (Wave Race 64), the camera, the cross-system levers |
| `water-feel` | The sea: the Gerstner sum, the JONSWAP/PM spectrum, dispersion, shoaling, breaking, fetch, the gusts; `make waves` |
| `craft-physics` | The hull's answer: probes, buoyancy, planing (Savitsky), slamming, the waterjet, nozzle steering, lean, flight; `make ride` |
| `craft-tuning` | What separates the skiff, the marlin, the otter and the dart; the catalog; the roster read off `make sim` |
| `craft-design` | How a craft LOOKS: the parametric builder, the styles, the `SCENE=rest` contact sheet |
| `collision` | The hull meeting what is not water: solids, grounding, ramps, gates and misses, bounds; what the events mean |
| `engine-system` | Adding or changing a gameplay system, engine-first |
| `mapgen-improvement` | The shore generator: rules / search / geometry, the R-rules, the analyze → fix → `make level` loop |
| `nature` | The shore's materials as biome-as-data, what `terrain.ts` paints, the rocks; later the flora |
| `hud-and-menus` | The HUD's readouts, the handlebar and the throttle lever, the keys; menus are placeholders |
| `ui-review` | The fit-and-finish sweep at the reference viewports |
| `playtest` | Staged moments photographed in the built app: `make screenshots SCENE=` |
| `test-scenario` | Exact situations: synthetic levels, `placeRun`, scripted inputs, `scenarios.ts` read three ways |
| `debug-game` | Deterministic repros, classifying by layer, the failing test first |
| `simulate-run` | `make sim`: the `RunReport` table, its columns, which movements are regressions |
| `bot-improvement` | The gate-aiming bot in `engine/sim/bot.ts`, kept minimal, measured with `make sim` |

## Reserved

Subjects the vertical slice leaves as placeholders. Each will be a skill of
its own when its subject is built; until then a lesson about one waits,
scoped, in the nearest existing skill. The name is fixed now so the router
row and the `.lessons/` directory land where the next session expects them.

| Future skill | Will own |
| --- | --- |
| `sound-effects` | Every sound synthesized from parameters — the engine note, the spray, the slam, the gate's chime — under `pwa/src/game/audio/`; the audition page |
| `soundtrack` | The tracker scores under `pwa/src/game/audio/scores/`; the listen-with-voices-muted loop |
| `atmosphere` | The sky system (`pwa/src/game/sky.ts`): the sun's clock from `level.hour`, clouds, mist, weather, the light on the water; `make sky` |
| `visual-effects` | Transient FX: the spray sheet, the wake, the landing plume, the ring's flash, camera shake — event → effect |
| `wipeout` | The craft past saving: the capsize, the rider thrown, the recovery — the sibling game's `crash`, for water |
| `damage` | `engine/game/damage.ts` + `pwa/src/game/damage-fx.ts`: what a hit costs the machinery and how it reads; the sibling game's damage half of `collision` |
| `tricks` | `engine/game/tricks.ts`: the aerial vocabulary and its scoring — the backflip is reachable today and scored then |
| `rider` | `pwa/src/game/rider.ts`: the parametric rider on the seat, the lean drawn, the stand-up's stance |
| `craft-creation` | A craft remade after photographs of a real one — the ruled crop, the overlay — the sibling game's `car-creation` |
| `built-shore` | What people put on the shore: harbours, jetties, a lighthouse, moored boats, the crowd — the sibling game's `built-world` |
| `fauna` | `engine/mapgen/fauna.ts` + `pwa/src/game/fauna.ts`: the fish and animals in the sea, placed by the biome, seeded |
| `level-rating` | `engine/rating/`: whether a generated level is any GOOD as a race, the trait bands, the campaign ladder; `make rate` |
| `campaign` | `pwa/src/game/campaign.ts`: which seeds become the campaign's levels, the modes (Time Trial, Heads Up, Roam), the menus behind them |
| `replay` | `pwa/src/game/replay.ts` + `engine/sim/tape.ts`: a run recorded and watched again |
| `debug-tools` | The in-game developer overlay, the REPRO line, `make debug-shot` — when a bug arrives as a picture |
| `platform-shells` | `tauri/` and `native/`: the desktop and store apps around the built site |
| `store-listing`, `store-shots` | The storefront's words (gitignored copy) and its screenshot set |
