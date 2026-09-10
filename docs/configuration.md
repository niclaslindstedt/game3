# Configuration

Sea Haven has no runtime configuration surface (no accounts, no server); everything below is a URL parameter, build-time, or repo plumbing.

## URL parameters

The running game reads its whole situation off the URL, which is what makes a level a link and a bug report a repro:

| Parameter | Meaning                                                                                                                                                                                                                                                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `seed`    | The level seed. Every shore, sea, gate and ramp is generated from it; the same seed is the same level on every machine.                                                                                                                                                                                                                     |
| `craft`   | Which craft: `skiff`, `marlin`, `otter` or `dart`.                                                                                                                                                                                                                                                                                          |
| `scene`   | A staged moment from `pwa/src/game/scenarios.ts` (`cruise`, `carve`, `brake`, `chop`, `launch`, `landing`, `dive`, `backflip`…) for labs and shots.                                                                                                                                                                                         |
| `t`       | Seconds into the scene to stand at.                                                                                                                                                                                                                                                                                                         |
| `shot`    | `1` freezes the frame for the screenshot tool and sets `window.__SH_READY__` when it is drawn.                                                                                                                                                                                                                                              |
| `wind`    | A wind speed, m/s, in place of the level's own (from the same quarter) — the sea is grown from it too.                                                                                                                                                                                                                                      |
| `hs`      | A sea quoted by its significant height, m, in place of the one the wind grows: `hs=20` is the storm the model is sized to carry.                                                                                                                                                                                                            |
| `hour`    | An hour on the clock (solar time, 0–24) in place of the level's own, so any seed can be ridden at sunrise or sunset. The sun, the sky and what the water reflects follow it; the sea does not.                                                                                                                                              |
| `time`    | The start card's TIME row: `sunrise`, `day` or `sunset`, resolved by the engine against this coast's own daylight window (R13) rather than as three hours written down. `hour` wins where both are given.                                                                                                                                   |
| `day`     | The start card's WIND row: `fine`, `windy` or `storm` — the wind, and so the sea the fetch law grows out of it, plus the sky that belongs over that wind. `wind` and `hs` each win over it, being the exact figure.                                                                                                                         |
| `weather` | The start card's WEATHER row: a sky (`clear`, `high`, `overcast`, `rain`, `squall`) in place of the one the wind implies. The sea stays the wind's, so a squall asked for this way is a squall's light over whatever sea is running.                                                                                                        |
| `camera`  | The rung of the camera ladder a run opens on: `bow`, `nose`, `close`, `chase`, `far` or `heli`. The camera key still walks the whole ladder from there. Named so a shot, a bug report or a link can stand on one view — `scripts/screenshot.mjs`'s `--camera` names the file after it, which is how the ladder is judged rung against rung. |
| `water`   | The picture's WATER row: `low`, `medium` or `high` — how fine the near water grid is, how far out it reaches, and how far the shader's ripples survive. The one row whose bill is CPU rather than pixels.                                                                                                                                   |
| `res`     | The picture's RESOLUTION row: `low`, `medium` or `high` — what share of the device's own pixels the frame is drawn at, under the page's `MAX_DPR` cap.                                                                                                                                                                                      |
| `detail`  | The picture's DETAIL row: `low`, `medium` or `high` — the spray off the hull, the sea life under it, how thickly the shore is planted, how many sheets of cloud are in the sky (and so in the sea reflecting it), and whether the rain lands on the water, as one choice.                                                                   |
| `see`     | `0` closes the water's window: the near sea is solid at every angle and nothing under it — the bed, a rock's foot, a school — is drawn. `1` opens it.                                                                                                                                                                                       |
| `start`   | `1` skips both cards and rides — a pinned run.                                                                                                                                                                                                                                                                                              |
| `paused`  | `1` rides one and holds it under the pause card straight away, which is how that surface is photographed and how a report about it is handed on. Implies a run, so `start` is not needed beside it.                                                                                                                                         |
| `splash`  | `0` clears the attract card off an ordinary visit (what the developer page's repro links carry); `1` forces it back on.                                                                                                                                                                                                                     |
| `menu`    | Open the front door ON a page: `root`, `start`, `craft`, `options` or `developer`. `developer` lets the developer menu out with it — a URL that names the page has, by definition, found it.                                                                                                                                                |
| `update`  | `1` shows the new-build button as if a newer build were waiting — the only way to look at it before a deploy has landed on a device that already had the app. The second press reloads the page.                                                                                                                                            |

A URL that names a RUN (`start`, `scene`, `shot`, `paused`) boots into one, past the attract card and the front door. Anything else opens the front door, with the URL's seed, craft, time, day, weather and picture rows as the settings it is standing on — so a link decides what RIDE rides without deciding that it has already been pressed. Every one of these except `update` is a row on the start card, the craft card, the options page or the developer page. COPY REPRO LINK writes back what decides the RUN — the seed, the craft, the day and the developer's own overrides; the picture rows are a fact about the machine reading the link rather than about the frame, so they are left to whoever opens it. `scripts/screenshot.mjs` and `scripts/profile-render.mjs` both take them as flags (`--water`, `--res`, `--detail`, `--see`), which is how a picture ladder is looked at and metered one stop at a time; the screenshot tool takes `--camera` the same way.

The debug switch the spec asks for (§19.3) is the dev build: `npm run dev` lifts the engine's `debug`-level output onto the console through `pwa/src/output-bridge.ts`, and the same lines are kept in an in-memory ring buffer every build can read back.

## What the game remembers

Everything the player chooses — the craft, the shore's seed, the hour to ride it at, the wind and the sky to ride it under, the camera, whether the HUD is drawn and whether it shows the frame rate, the four picture rows, and a developer's own rows once the menu has been let out — is kept in `localStorage` under `sea-haven-settings` and read back through `mergeSettings` (`pwa/src/game/settings.ts`). The merge is field by field and every value is checked against what the build still offers, so a blob written by an older build keeps the choices that still exist and quietly drops the ones that do not. Clearing site data is a first visit again; storage being unavailable is a session on the defaults, which is a perfectly good game.

The **developer menu** is let out by holding START on the front door for seven seconds, and it stays out. RESTORE DEFAULTS on the options page deliberately leaves it out; LOCK THE DEVELOPER MENU on the developer page is the way back.

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
