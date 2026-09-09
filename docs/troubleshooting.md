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
