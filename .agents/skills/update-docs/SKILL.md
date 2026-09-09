---
name: update-docs
description: "Use when docs/ may be stale. Discovers commits since the last docs sync, maps changed source to the pages that describe it, and brings docs/*.md back into agreement with the code."
---

# Updating the docs

**Governing spec sections:** §11.1 (`docs/` — real prose, no stubs, resolving cross-links), §21.5 (mandated because `docs/` is drift-prone).

The `docs/` pages describe the engine, the water and craft models, the generator's rules, the sim harness, and the deploy plumbing. Each has concrete source files it must agree with; this skill re-syncs them.

## Tracking mechanism

`.agents/skills/update-docs/.last-updated` contains the git commit hash from the last successful run. Empty means "never run" — fall back to the initial commit.

## Discovery process

1. Read the baseline:

   ```sh
   BASELINE=$(cat .agents/skills/update-docs/.last-updated)
   ```

2. List changed files since then:

   ```sh
   git diff --name-only "$BASELINE"..HEAD
   ```

3. Walk the mapping table; every hit schedules the named page for a re-read against its sources.

4. For scheduled pages, read the page AND its source files side by side; fix what disagrees (numbers, names, commands, claims, the model a formula is attributed to).

## Mapping table

| Changed source | Page(s) to re-sync |
| --- | --- |
| `engine/game/water.ts`, `engine/game/wind.ts` (the spectrum, dispersion, shoaling, breaking, fetch, gusts) | `docs/water.md` |
| `engine/game/craft.ts`, `hull.ts`, `flight.ts`, `limits.ts`, `engine/game/defs/tuning.ts`, `defs/craft.ts` | `docs/riding.md` |
| `engine/game/collision.ts`, `course.ts` (grounding, ramps, gates, misses, reset) | `docs/riding.md` |
| `engine/mapgen/rules.ts` (the R-rules are quoted verbatim) | `docs/level-generator.md` |
| `engine/mapgen/generate.ts`, `compile.ts`, `shore.ts`, `geology.ts`, `course.ts`, `biomes.ts` | `docs/level-generator.md` |
| `engine/analysis/*` (a check, a budget) | `docs/level-generator.md` (the scoring table) |
| `engine/sim/*`, `scripts/simulate-run.mjs` (the bot, `RunReport`, the table's columns) | `docs/simulation.md` |
| `engine/index.ts`, module moves under `engine/` or `pwa/src/` | `docs/architecture.md` |
| `pwa/src/game/input.ts`, `input-model.ts`, `hud.tsx`, `hud-touch.tsx` | `docs/getting-started.md` |
| `pwa/src/game/scenarios.ts`, `scripts/ride-lab.mjs`, `scripts/waves-lab.mjs`, `scripts/level-map.mjs` | `docs/simulation.md` (the labs), README Usage |
| `.github/workflows/pages.yml`, `release.yml`, `pwa/pwa-plugin.ts` | `docs/configuration.md`, `docs/platforms.md` |
| `pwa/src/identity.ts`, `pwa/public/*` | `docs/configuration.md` |
| `tauri/README.md`, `native/README.md` (the shells, once they are more than placeholders) | `docs/platforms.md` |
| Error-shaped changes (new failure modes, new tooling) | `docs/troubleshooting.md` |
| `OSS_GAME_SPEC.md`, or a verdict under one of its chapters | `docs/spec-conformance.md` — the `sync-game-spec` skill re-dates it |

## Update checklist

- [ ] Read baseline and diff
- [ ] Re-sync every scheduled page against its sources
- [ ] Verify cross-links between docs pages and from the README still resolve
- [ ] `make fmt-check`
- [ ] Write the new baseline:

      git rev-parse HEAD > .agents/skills/update-docs/.last-updated

## Verification

1. Every quoted rule, number, command, filename and model citation in the touched pages exists in the source it cites.
2. No page contains "TODO" or stub text.
3. `.last-updated` points at the new HEAD.

## Skill self-improvement

After a run, grow the mapping table with any new source → page relationship you discovered, note recurring drift patterns (e.g. tuning constants quoted in prose, a spectrum parameter restated in `docs/water.md`), and commit the skill edit together with the docs edit.
