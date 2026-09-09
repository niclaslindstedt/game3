# Configuration

Sea Haven has no runtime configuration surface (no accounts, no server); everything below is a URL parameter, build-time, or repo plumbing.

## URL parameters

The running game reads its whole situation off the URL, which is what makes a level a link and a bug report a repro:

| Parameter | Meaning                                                                                                                           |
| --------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `seed`    | The level seed. Every shore, sea, gate and ramp is generated from it; the same seed is the same level on every machine.           |
| `craft`   | Which craft: `skiff`, `marlin`, `otter` or `dart`.                                                                                |
| `scene`   | A staged moment from `pwa/src/game/scenarios.ts` (`cruise`, `chop`, `launch`, `landing`, `dive`, `backflip`…) for labs and shots. |
| `t`       | Seconds into the scene to stand at.                                                                                               |
| `shot`    | `1` freezes the frame for the screenshot tool and sets `window.__SH_READY__` when it is drawn.                                    |
| `wind`    | A wind speed, m/s, in place of the level's own (from the same quarter) — the sea is grown from it too.                            |
| `hs`      | A sea quoted by its significant height, m, in place of the one the wind grows: `hs=20` is the storm the model is sized to carry.  |

The debug switch the spec asks for (§19.3) is the dev build: `npm run dev` lifts the engine's `debug`-level output onto the console through `pwa/src/output-bridge.ts`, and the same lines are kept in an in-memory ring buffer every build can read back.

## Installing

Every dependency resolves from the public npm registry, so `npm install` needs no token and no `~/.npmrc` entry. Claude web sessions run `.claude/hooks/session-start.sh`, which installs and builds in the background so the tooling is ready when the session opens.

## Build-time environment

| Variable                           | Meaning                                                                                                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_BASE`                        | Deploy base path: `/` (default), `/preview/`, `/branch/`. Drives the SW scope, the manifest identity, and every emitted URL.                                   |
| `VITE_PWA_IGNORE_PATHS`            | Comma-separated absolute paths the built service worker must NOT claim. Only the root slot sets it (`/preview/,/branch/`) so nested slots own their own pages. |
| `GITHUB_SHA` / `GITHUB_RUN_NUMBER` | Provided by CI; baked into the build label the HUD corner shows.                                                                                               |
| `CHROMIUM_PATH`                    | The browser the screenshot and profile tools drive. Claude web sessions have one at `/opt/pw-browsers/chromium`.                                               |

`.env.example` at the root documents the same set; copy it to `.env` (gitignored) to override locally.

## The deploy slots

`pages.yml` builds three whole sites and merges them into one Pages artifact served at `game3.niclaslindstedt.se` (the custom domain in `pwa/public/CNAME`; DNS is a CNAME on `niclaslindstedt.github.io`, and the repo's Pages settings must say "GitHub Actions" + that domain):

- `/` — the highest `v*` tag (or `main` before the first release), with `VITE_PWA_IGNORE_PATHS` set so its service worker disowns the nested slots.
- `/preview/` — the triggering `main` commit, every push.
- `/branch/` — parked by `workflow_dispatch` with a `branch_ref` input; persisted in the `branch-deploy` orphan branch so ordinary deploys carry it forward until the next dispatch overwrites it.

Each slot's manifest gets a distinct `id`/`scope`/`start_url` and install name, so side-by-side installs don't collide.

## Releases

`version-bump.yml` (manual dispatch, and the only entry point) checks the branch and the tree, prints the version it is about to cut, and calls `release.yml`, which derives the bump from `.changes/unreleased/` fragments, rewrites every version string via `scripts/update-versions.sh`, collates the CHANGELOG, commits `chore(release): vX.Y.Z`, tags, creates the GitHub Release, and chains into `pages.yml` so `/` serves the new tag immediately. It is one dispatched run under the default `GITHUB_TOKEN` — no `RELEASE_TOKEN` PAT, because no cross-workflow trigger is needed (both workflow headers say why). Preview locally with `make bump` and `make changelog VERSION=X.Y.Z`.

## Identity

Name, copy, palette, and URLs live in `pwa/src/identity.ts` and nowhere else; `pwa/index.html` (SEO head and the prerendered copy), `pwa/public/` (robots/sitemap/llms/CNAME, the privacy and support pages), and the icon generator all follow it. Changing identity means touching those in the same change — AGENTS.md's parity table is the checklist.

## Losing focus

A hidden tab, a minimised window or a phone call **pauses the run** — the run clock included — and coming back lands on the very frame it left (OSS_GAME_SPEC §37.3). This is a single-player game, so there is nobody the world has to keep moving for. The decision lives in `pwa/src/game/run-loop.ts`, which also clamps a long frame to a tenth of a second and drops the time beyond it rather than simulating a stall (§37.2).
