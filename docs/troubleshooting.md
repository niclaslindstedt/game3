# Troubleshooting

## Installing / building

**`npm install` fails to reach a registry.**
Every dependency comes from the public npm registry; the repo commits no `.npmrc` and needs no token. A 401/403 is a stale `//npm.pkg.github.com/:_authToken=` or `@niclaslindstedt:registry=` line left in **your** `~/.npmrc` from an earlier checkout — delete it.

**`make lint` / `make test` pass locally but CI disagrees.**
Check the Node major (`.nvmrc` is what CI runs; ≥22 works) and that you ran the Make target, not a bare tool — the targets chain typechecks the bare tools skip.

## Playing

**Black or empty canvas.**
The renderer needs WebGL2. Check `chrome://gpu`, disable GPU-blocking extensions, or try another browser. If the page loads but the canvas errors, the console will name the failure — file it with the level seed.

**The game feels slow / choppy on the phone.**
The engine steps at a fixed 120 Hz regardless of frame rate, so physics stays correct; choppiness is render-bound — and the water mesh is the one thing that costs, since every vertex is displaced on the CPU each frame. Close other tabs, and prefer the installed (home-screen) app — browsers throttle busy tabs.

**The craft will not turn.**
It is off the throttle. A jet ski steers by pointing its thrust, and with no thrust there is nothing to point — that is the real off-throttle characteristic, kept on purpose. Open the throttle and the nozzle has something to work with.

**Every landing is a dive.**
The nose is down. Lean BACK (S / ↓, or pull the handlebar thumb toward you) as the ramp throws you, and level the hull before the water arrives: a bow that meets the surface first is dragged under, and the pitch-down moment that follows is the dive.

**Stale version after a deploy.**
Updates are prompt-gated: the new build installs in the background and asks before swapping. If the prompt was dismissed, reload twice, or clear site data for the domain as a last resort.

**Installed app opens the wrong variant (preview vs release).**
The three deploy slots are separate installs with separate identities. Check which slot the tile's name says — "(preview)" / "(branch)" — and install from the slot you want.

**Touch controls don't show on a laptop.**
By design: devices with a fine pointer + hover get keyboard controls only. The handlebar and the lever appear on touch devices.

## Developing

**A tuning change made the bot sims fail.**
That's the harness working. Read [simulation.md](simulation.md): reproduce with `npm run sim -- --seeds <failing>`, trace with the event log, and either fix the regression or argue the test's world moved — explicitly, in the PR.

**The craft floats wrong after a hull change.**
`make ride SCENARIO=rest` draws it: the craft at rest must sit at the draft its mass and displacement imply, and a denser craft must sit lower. The buoyancy test holds the same numbers.

**`make screenshots` can't find a browser.**
Install the driver (`npm i --no-save playwright-core`) and point at a Chromium: `CHROMIUM_PATH=/opt/pw-browsers/chromium make screenshots` (that path is preinstalled in Claude web sessions).

**Pre-commit hook rejects CHANGELOG.md.**
Intended — the file is machine-written. Put your note in a `.changes/unreleased/` fragment instead (CONTRIBUTING.md shows the format).

## The governance tests

The suite holds the repository's shape as well as its physics. When one of these goes red, the message names the file; this is what each one means.

**`tests/imports_test.ts` — "imports the package … the engine is framework-free".**
Something under `engine/` imported `three`, `preact`, a `node:` module or anything else external. The engine imports nothing but itself, so it can run in the browser, in the sim CLI and in the test runner unchanged. Move the code to `pwa/` or `scripts/`, or do without the package.

**`tests/imports_test.ts` — "reaches into the engine at …; use @engine".**
An app module or a test imported `engine/game/…` directly. `engine/index.ts` is the one public surface; if the symbol is not exported there, export it there — that is a review-visible change to the engine's API, which is the point.

**`tests/imports_test.ts` — "imports … from scripts/".**
Nothing imports tooling. A helper two files want to share goes in `engine/lib/` (if it is generic) or `pwa/src/lib/`, never in `scripts/lib/`.

**`tests/imports_test.ts` — "a wall clock" / "Math.random" / "console".**
A run has to replay from its seed, so nothing in `engine/` reads the clock or a global random source; draw from `state.rng`, and print through `engine/output.ts`. The analyzer's report timer is the one recorded exception.

**`tests/file_size_test.ts` — "is N lines".**
A source file passed a thousand physical lines. Split it by concern; if it is genuinely dense (a rule catalogue, a lookup table), put `game-spec:allow-large-file: <reason>` in a comment in its first twenty lines — with a real reason, and only while it is actually over the cap.

**`tests/symlinks_test.ts` — "is a regular file, not a symlink".**
A checkout without symlink support (Windows without developer mode) or an editor that dereferenced `CLAUDE.md` into a copy. `git config --global core.symlinks true` and re-checkout; never edit the alias, edit `AGENTS.md`.

**`tests/identity_test.ts` after a rename or a domain move.**
The failure lists every file restating the old name or URL: `pwa/index.html`, the files under `pwa/public/`, both `package.json`s, the README, the icon generator's palette. Change them all in the same commit, then `make icons`.

**`tests/skills_test.ts` — "routes to … which is not a skill" / "names every skill on disk".**
`AGENTS.md`'s Skills section, the labs table and the routing table must name exactly the directories under `.agents/skills/`. Renaming a skill is four edits: the directory, its front-matter `name`, `AGENTS.md`, and `.agents/skills/README.md` (plus the `maintenance` registry for an `update-*`).

**`tests/docs_rules_test.ts` — "is not in the doc" / "word for word".**
A rule in `engine/mapgen/rules.ts`'s header has no mirror, or a different one, in `docs/level-generator.md`. The doc carries the R-rules verbatim; copy the prose across (one bullet per rule, one line each) and keep the numbers table beside it honest.

**`tests/changeset_test.ts` — "has type …" / "hand-written Unreleased content".**
A fragment's `type:` is outside `Added | Changed | Fixed | Removed | Security | Deprecated` (case-sensitive), or CHANGELOG.md was edited by hand. Fix the word; move the note into a fragment.

## The labs and the tools

**"level generation failed for seed N after 24 attempts".**
Every sub-seed the search tried produced a coast that could not carry a legal course, or one the analysis rejected — the message ends with the last rejection's rule codes. `make analyze SEED=N` prints the findings; `make level SEED=N` draws what it was trying to build. A rules change that makes many seeds fail is a rules change that moved a band past what the coast can give (`mapgen-improvement` owns the loop).

**A lab exits 2 with "unknown flag".**
Every tool in `scripts/` parses its flags through `scripts/lib/cli.mjs` and refuses one it does not know — a measurement tool that ignored a typo would report a confident wrong number. `--help` prints the flags with their defaults.

**`ERR_INVALID_MODULE_SPECIFIER: Invalid module "@engine"` from a Node script.**
Plain Node knows nothing of the `@engine` alias the app and the tests use. A script that imports an app module (`pwa/src/game/scenarios.ts`, a style table) registers `aliasEngine(root)` from `scripts/lib/engine-alias.mjs` BEFORE the dynamic `import()` that needs it. The engine itself needs nothing — import `engine/index.ts` by path.

**`make sim` exits 1 with "finished no seed at all".**
A craft could not get round any of the default seeds inside the cap. That is CI's `simulate` job failing on purpose: read the table's `rst`, `miss` and `dive` columns to see whether the hull, the bot or the level is at fault ([simulation.md](simulation.md) says which movement means what), and `make ride SCENARIO=` to look at it.

**`make screenshots` / `make profile` measure the wrong build.**
Both serve `pwa/dist`; `make build` first, every time. A stale dist photographs the last change rather than this one, and the picture reads as a bug in the code.
