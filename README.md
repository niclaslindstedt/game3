# Sea Haven

> A personal-watercraft racing game for the browser: generated northern shores, water built from real wave physics, a jet ski that floats, planes, flies and dives the way a hull actually does — playable on your phone or desktop, installable as a PWA, offline once loaded. **[Play it now](https://game3.niclaslindstedt.se/).**

[![ci](https://github.com/niclaslindstedt/game3/actions/workflows/ci.yml/badge.svg)](https://github.com/niclaslindstedt/game3/actions/workflows/ci.yml)
[![seo](https://github.com/niclaslindstedt/game3/actions/workflows/seo.yml/badge.svg)](https://github.com/niclaslindstedt/game3/actions/workflows/seo.yml)
[![release](https://github.com/niclaslindstedt/game3/actions/workflows/release.yml/badge.svg)](https://github.com/niclaslindstedt/game3/actions/workflows/release.yml)
[![pages](https://github.com/niclaslindstedt/game3/actions/workflows/pages.yml/badge.svg)](https://github.com/niclaslindstedt/game3/actions/workflows/pages.yml)
[![spec](https://img.shields.io/badge/OSS__GAME__SPEC-v1.1.0-blueviolet)](OSS_GAME_SPEC.md)
[![license](https://img.shields.io/badge/license-PolyForm--NC-blue.svg)](LICENSE)

## What

Sea Haven is an arcade jet ski racer — no account, no download, free. The feel target is the 90s jetski racers with a modern look: the whole game is the sensation of a hull meeting a wave, so the water and the craft on it are grounded in published models rather than guessed. The sea is a sum of real waves built from the level's wind by a fetch-limited spectrum — half a metre of sea in the lee of the shore, growing the further out you ride, shoaling over the shallows and breaking where it gets too tall for the depth under it — and the hull floats on that surface by displacement, lifts onto the plane as speed rises, feels the orbital push of every crest, decelerates hard on a hard landing and DIVES on a nose-down one. There is no brake, no handbrake and no gear: a throttle, a nozzle, and a rider who leans. With no thrust there is almost nothing to steer with, so a turn is taken on the gas, which is the one thing to learn.

Every level is **generated from a seed** by a rules engine, like the sibling rally game's stages: a stretch of shore — bedrock slabs, boulder fields, sand pockets, skerries offshore, a Bothnian coast — the water beside it, and a race course laid along the shore within a hundred metres of it: buoy gates you cross and **air gates** — rings hanging over the water, each with a floating ramp moored before it, so the course throws you into the air and asks you to land. Wind, the season, the hour the run starts at, the sky over it — clear, high cloud, overcast, rain or a squall, drawn with the level's own wind weighting the draw, so the darkest skies stand over the biggest seas — and the water temperature all come with the seed; the same seed is the same shore on every machine, so a URL is a level and a bug report is a repro.

Four craft ship, invented names and no real brands, and what separates them is real physics off a data card: the **skiff** (a light runabout — quick, nimble, skittish in chop), the **marlin** (heavy performance — the fastest, and it needs room), the **otter** (stable touring — the heaviest, the softest over waves, slow to turn) and the **dart** (a stand-up — the lightest, the most agile, the least stable). Every hull, every wave and every shore is written in code; the game ships no asset files.

**What exists today is the vertical slice**: the game opens on an attract card, then a front door with START and OPTIONS over a sea the bot is already riding; START stands a run up behind a loading card, one generated taiga level under a sky built from its own season, hour and weather — and the sun moves, an hour a minute, so a run rides through sunset, twilight, a night under the moon and the stars with the craft's lamp on the water, and on into the dawn's mist — one craft to ride it with a rider on the saddle who leans, tucks and takes the waves in his body, and a HUD with a minimap reading the run — free-ride the shore or run the gates. Escape or a press on the minimap holds the run under a pause card with RESUME, a strip of the settings you stop mid-run for, and MAIN MENU on it. A developer page sits behind a seven-second hold on START. The run has a sound — the engine and the pump's whine, the spray, the wind, the swell and the surf on the shore, and every landing, dive, slap and chime — all of it synthesized from authored parameters, nothing a file. Rain and lightning on the water, damage, the campaign, time trial, heads-up, the map viewer, roam, trick scoring and the fauna are each a placeholder file with a header saying what will live there. Both platform shells are built, each a thin wrapper over the same site packed inside it: the desktop app (`tauri/`, one window in the platform's own webview) and the store app (`native/`, a full-screen WebView with the phone's haptics under the sea).

## Why

- **The water first.** The wave model is the game: Gerstner waves off a JONSWAP spectrum, real dispersion, shoaling and breaking, a fetch law that grows the sea offshore. The renderer displaces its mesh by calling the SAME function the physics reads, so what is drawn is what is simulated.
- **A hull, not a car.** Buoyancy off twenty-two hull probes, Savitsky's planing lift, von Kármán slamming on re-entry, a waterjet whose thrust vanishes when the intake leaves the water — each force stated once, with its source. The craft at rest floats at the draft its mass implies, and a test holds it there.
- **Flying, and landing.** A ramp is a plane the hull rides up; off it the craft is ballistic, the wind leans on it, the lean pitches it. Land level and it skips on; land nose-down and it dives; hold the lean off a big ramp and a backflip is reachable — reachable, not scored.
- **Levels, endlessly.** A rules engine builds every shore and every course under hard constraints (see [docs/level-generator.md](docs/level-generator.md)) — same seed, same level, shareable and replayable.
- **Measured, not guessed.** A headless simulator rides a bot through the real engine ([docs/simulation.md](docs/simulation.md)); the balance table, the wave lab and the ride lab keep the water, the hull and the generator honest with each other.
- **Web-native.** One codebase, phone-first, portrait and landscape, installable, offline-capable. Desktop and store shells come later ([docs/platforms.md](docs/platforms.md)).

## Prerequisites

- Node.js 22+ (CI pins the version in [`.nvmrc`](.nvmrc))
- npm 10+

## Install

```sh
git clone https://github.com/niclaslindstedt/game3
cd game3
npm install
```

Every dependency comes from the public npm registry — no token, no registry configuration.

## Quick start

```sh
npm run dev
```

Open the printed URL. The game boots straight onto the water: seed 1's shore, the skiff idling behind the first gate, and the run starts when you open the throttle. `?seed=38` on the URL opens another shore; `?craft=marlin` picks the craft.

## Usage

| Command              | What it does                                                                                                                                                                                                                                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`        | Dev server (no service worker)                                                                                                                                                                                                                                                                                              |
| `make build`         | Typecheck + production build to `pwa/dist/`                                                                                                                                                                                                                                                                                 |
| `make test`          | Full test suite (waves, buoyancy, craft, flight, collision, course, generator, bot sims) — `SHARD=i/N` runs one slice, which is how CI fans it out                                                                                                                                                                          |
| `make lint`          | ESLint + typecheck across engine, app, tests, and tooling                                                                                                                                                                                                                                                                   |
| `make fmt`           | Prettier in place (`make fmt-check` is what CI runs)                                                                                                                                                                                                                                                                        |
| `make sim`           | Headless balance sweep: the bot rides generated levels (240 s cap per run), prints the pace / gates / air / dives table per seed and craft — `SEEDS=`, `CRAFT=`, `TRACK=circuit`, `ARGS="--max 300"` for any other flag                                                                                                     |
| `make level`         | `SEED=38` — one level from above to `previews/level-<seed>.png`: depth shading, the shore, the solids, every gate numbered with its ramp, the wind arrow; plus a table of every gate with its offshore distance and depth. `TRACK=circuit` draws the ocean circuit that seed deals instead                                  |
| `make analyze`       | Score generated levels: gates within 100 m of shore, depth along the path, solids clear of it, the run-up before every ramp, gate spacing and course length — exits non-zero on an error finding. `TRACK=circuit` scores circuits against R29–R31 instead                                                                   |
| `make waves`         | The waves lab: the sea on its own to `previews/waves-<seed>.png` — a transect from the shore out at several moments, Hs against offshore distance, the spectrum; a table of Hs, Tp, wavelength and breaking depth                                                                                                           |
| `make ride`          | The ride lab: `SCENARIO=launch` — the craft in profile every sixth of a second over the water it crossed, to `previews/ride-<scenario>.png`, with speed, pitch, wetted share, rpm and air time beside each cell (`ARGS=--assist=0` rides it without the arcade landing assist)                                              |
| `make audition`      | The ear: the audio review page to `previews/audition.html` — every sound in the bank on a button beside its description, the engine and the water beds under sliders and a row of seats; `ARGS=--meter` drives it in a headless Chromium and prints every level in dBFS (`CRAFT=marlin` for another rev band)               |
| `make crafts`        | The craft sheet: every craft from the app's own builder in side, bow, stern, plan and chase views, the rest waterline and the buoyancy probes over it, to `previews/crafts.png`; a table of draft, freeboard, bar height and triangle count — `CRAFT=` for one                                                              |
| `make screenshots`   | Drive the built app headlessly and screenshot the staged scenes at desktop landscape and phone portrait, to `previews/` (`HOUR=20.5 WEATHER=clear` rides the seed under another light; `CAMERA=heli` stands it on one rung of the camera ladder)                                                                            |
| `make flora`         | The flora lab: every species on the shore side by side as one labelled contact sheet to `previews/flora.png` — each drawn at both ends of its own height band over a metre rule, which is the only way a roster can be judged (`ARGS="--rows=reed,alder"` for a slice)                                                      |
| `make sky`           | The sky lab: every weather against every three hours of the clock, day and night, on one coast in one season, as one labelled contact sheet to `previews/sky.png` — the ladder side by side, which is the only way it can be judged (`ARGS="--season=autumn"` for the dark nights, `ARGS="--rows=squall,rain"` for a slice) |
| `make profile`       | Meter what one frame costs the renderer — draw calls, triangles and binds per scene                                                                                                                                                                                                                                         |
| `make icons`         | Regenerate PWA icons, favicon and the OG image from the app mark                                                                                                                                                                                                                                                            |
| `make tauri`         | The desktop app: build the site into `tauri/webroot/`, compile the Tauri shell and launch it (`make tauri-test` runs its decision layer, `make tauri-lint` clippy over both crates, `make tauri-fmt` rustfmt)                                                                                                               |
| `make desktop`       | Package this machine's desktop downloads into `tauri/release/` — a `.deb` + `.AppImage`, a `.dmg`, or an NSIS installer (`ARGS="--target <triple>"` for an explicit target)                                                                                                                                                 |
| `make check-seo`     | Build + structural SEO/PWA/bundle-budget assertions                                                                                                                                                                                                                                                                         |
| `make hooks`         | Install the pre-commit / commit-msg git hooks                                                                                                                                                                                                                                                                               |
| `make shellcheck`    | Lint the shell scripts and hooks (`make actionlint` the workflows)                                                                                                                                                                                                                                                          |
| `make bump`          | Print the semver bump the release would derive from the changeset fragments (`make changelog VERSION=X.Y.Z` previews the CHANGELOG section)                                                                                                                                                                                 |
| `make native-bundle` | The store app: build the website and pack it into the zip the app serves (`native/assets/webroot.zip`) — before every device or EAS build                                                                                                                                                                                   |
| `make native-iphone` | Build the store app and put it on a real iPhone over USB, then launch it — `ARGS="--device 'my iPhone'"` picks between several (`native-ios` / `native-android` for the simulator and emulator, `native-install` / `native-typecheck` for the tree itself)                                                                  |

## Controls

**Keyboard:** W throttle (ramps up while held), A D / ← → steer (ramped, so a tap is a nudge and a hold is full lock), S / ↓ lean back (nose up — in the air, pitch up), Shift / ↑ lean forward (nose down), Space brake and reverse, R reset to the last gate passed, Enter restart the run, C camera (bow, nose, close, chase, far, heli — RESET and CAMERA are buttons under the minimap too), Escape pause. There is no gearbox, and the brake is not a pedal: Space drops the reverse BUCKET over the jet, which is the only way a watercraft slows itself and the only way it goes backwards. The stand-up carries no bucket, so on it the key does nothing.

**Pausing** holds the run exactly where it stands — Escape, or a press on the minimap, which is the way in on a phone. RESUME comes back on the very frame it left; between it and MAIN MENU is a strip of the three settings a rider stops mid-run for — the camera, the HUD and the frame rate — with the rest left to OPTIONS on the front door, where the sea behind the card is still moving. MAIN MENU hands the craft back to the bot and comes back to the front door over the shore you were just on.

**Touch:** the LOWER-LEFT of the screen is the handlebar — touch anywhere and move the thumb: sideways travel steers, vertical travel leans. The LOWER-RIGHT is the LEVER — a touch anchors it at its neutral and the throw runs both ways: dragging DOWN opens the throttle, full at about ninety pixels, and dragging UP pulls the brake and reverse instead, full at about sixty. Both are analogue, only one can be open at a time, and both are held while the finger is down and let go the moment it lifts. Both overlays are drawn under the thumb that owns them, and both stop at the lower three fifths of the screen so a press meant for the HUD's own buttons is not read as throttle. Works in portrait and landscape; the HUD re-flows to fit.

**Vibration:** on a phone the sea comes back through the motor — the bottom slapping the chop, every landing, every rock, sized by how hard the hull actually took it (OPTIONS ▸ RIDING ▸ VIBRATION, offered only where there is a motor to feel it with). In the store app the same table drives the phone's own haptic engine instead of the browser's buzz.

**On the phone:** the game is an installable PWA — open [game3.niclaslindstedt.se](https://game3.niclaslindstedt.se/), then "Add to Home Screen" (iOS Safari: Share → Add to Home Screen; Android Chrome: menu → Install app). It launches fullscreen, works offline, plays in portrait or landscape, and prompts in-app when a new build ships.

## Configuration

All configuration is a URL parameter or build-time:

- `?seed=`, `?craft=`, `?scene=`, `?t=`, `?shot=` — which level, which craft, and the staged moment the screenshot tool stands at; `?wind=`, `?hs=`, `?hour=`, `?season=`, `?weather=` ride it in another sea, from another hour, in another season, under another sky.
- `VITE_BASE` — deploy base path (`/`, `/preview/`, `/branch/`); set by the Pages workflow, defaults to `/`.
- `VITE_PWA_IGNORE_PATHS` — sibling deploy slots the root service worker must not claim; set by the Pages workflow.

See [docs/configuration.md](docs/configuration.md) for the full picture, including the deploy-slot model.

## Examples

The [`examples/`](examples/) directory holds known-good level seeds with their character ([examples/seeds.md](examples/seeds.md)). Try one:

```sh
npm run level -- --seed 38
npm run waves -- --seed 38
npm run sim -- --seeds 38,7 --craft marlin
```

## Troubleshooting

- **Black canvas / WebGL errors** — the renderer needs WebGL2; check `chrome://gpu` or try another browser. The engine itself is fine — `make sim` runs without any GPU.
- **The craft will not turn** — it is off the throttle. A jet ski steers by pointing its thrust; open the throttle.
- **Every landing is a dive** — lean back off the ramp and level the hull before the water arrives.
- **Stale build after deploy** — the service worker prompts before updating; if a prompt was dismissed, reload twice or clear site data.

More in [docs/troubleshooting.md](docs/troubleshooting.md).

## Architecture

Three layers, one direction of dependency: `engine/` is the whole game as a framework-free, renderer-free TypeScript module (the water, the wind, the craft, the course, the level generator, the bot and the analyzer — fixed 120 Hz steps, deterministic per seed); `pwa/` is the browser shell (Preact, three.js, the HUD, the PWA plumbing) that reads the engine's state and never steps it; `tests/` and `scripts/` sit beside them. [docs/architecture.md](docs/architecture.md) is the map; [AGENTS.md](AGENTS.md) is where new code goes.

## Documentation

- [Getting started](docs/getting-started.md)
- [Architecture](docs/architecture.md) — engine / renderer / shell layering
- [The water](docs/water.md) — the wave model and where each number comes from
- [Riding](docs/riding.md) — buoyancy, planing, the jet, the lean, flight and the landing
- [Level generator](docs/level-generator.md) — the rules engine and its R-rules
- [Simulation & the bot](docs/simulation.md) — the headless harness and the balance workflow
- [Audio](docs/audio.md) — the synth, the bank, the beds, the listener, and how to audition and meter them
- [Platforms](docs/platforms.md) — the web, the desktop app and the store app beside it
- [Configuration](docs/configuration.md) · [Troubleshooting](docs/troubleshooting.md)
- [Spec conformance](docs/spec-conformance.md) — where this repo stands against [OSS_GAME_SPEC.md](OSS_GAME_SPEC.md), chapter by chapter

## Contributing

Bugs and feature requests go to [GitHub Issues](https://github.com/niclaslindstedt/game3/issues); questions to [Discussions](https://github.com/niclaslindstedt/game3/discussions). Read [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow (conventional commits, changeset fragments, the labs-before-and-after rule for hull, water and generator changes). This repository conforms to [OSS_GAME_SPEC.md](OSS_GAME_SPEC.md).

## License

[PolyForm Noncommercial 1.0.0](LICENSE) — free to play, read, and modify for noncommercial purposes. Code and the generated assets alike: the game ships nothing it did not write, so there is no second license to state.
