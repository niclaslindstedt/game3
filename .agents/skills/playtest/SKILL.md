---
name: playtest
description: "Use to verify gameplay changes in the running game and to evaluate game feel and look. Drives the built app in headless Chromium to staged moments (rest, cruise, carve, chop, swell, launch, apex, landing, dive, offshore, backflip), screenshots them at both viewports, and closes the loop the sim numbers can't: does it LOOK and READ right on the water."
---

# Playtesting

Engine tests prove rules, the labs prove the models and `make sim` proves
balance; playtesting proves the game **works and reads right in the real
renderer**. Every gameplay, rendering, or input change ends with a look at the
actual pixels before it ships. The split: numbers say whether the game is
_sound_; pictures say whether it _looks and reads_ right.

**Before starting, read this skill's lessons** —
`node scripts/skill-lessons.mjs playtest --list`, then the ones this task
touches. Load **`skill-reflection`** at both ends of the session.

## Tooling

| Piece | Role |
| --- | --- |
| `pwa/src/game/scenarios.ts` | The staged moments, DOM-free: each is a `RunMoment` for `placeRun` plus a scripted input over N seconds — `rest`, `cruise`, `carve`, `chop` (headwind chop at speed), `swell`, `launch`, `apex`, `landing`, `dive`, `offshore`, `backflip`; `tests/scenarios_test.ts` holds that each stages what it says |
| `scripts/screenshot.mjs` | The harness: serves the built app (`pwa/dist`), opens `?seed=&craft=&scene=&t=&shot=1`, waits for `window.__SH_READY__`, captures to `previews/` (gitignored) at 1280×720 and 390×844 |
| `make screenshots SCENE=<name>` | Runs it for one scene. Needs `make build` first (it drives the BUILT app, not a dev server) and a Chromium |
| `make ride SCENARIO=<name>` | The SAME scenario on the bench — a strip of the hull over the water it crossed, with the numbers. No build, no browser, seconds. Run it before the screenshot: if the strip does not show the moment, the picture will not either |
| `npm run dev` | The headed loop — ride your working copy in a browser for anything a still can't judge (throttle feel, the lever, the sound of nothing yet) |
| `make level SEED=` | The level itself, top-down — when the question is the course rather than the rendering |

### Environment

`playwright-core` is installed with `npm i --no-save playwright-core`; only
the browser binary is separate. In Claude web sessions Chromium is
preinstalled — run:

```sh
CHROMIUM_PATH=/opt/pw-browsers/chromium make screenshots SCENE=chop
```

Never run `playwright install`; point `CHROMIUM_PATH` at an existing binary.

### The scenes

A scene is a scenario plus a shutter: the harness opens the app at
`?scene=<name>` and the app itself calls `placeRun` and plays the scripted
input, so the browser never drives anywhere — it STANDS the craft at the
moment and photographs it after `t` seconds. The moments that matter:

| Scene | What it photographs |
| --- | --- |
| `rest` | The craft afloat, idling, beside the shore — the draft, the paint, the HUD at its floor |
| `cruise` | Full throttle on moderate water — speed, the wake, the HUD at speed |
| `carve` | A committed turn — the roll into it, the inside sponson down, the wake bent |
| `chop` | Full throttle into a head sea — the drumroll: pitch, spray, small slams |
| `swell` | A long swell taken at speed — the lift, the crest, the drop |
| `launch` | Leaving a ramp — the nose up, the engine free |
| `apex` | The top of a flight through an air gate — the ring, the horizon, the air time on the HUD |
| `landing` | Coming down flat — the plume, the camera's shudder |
| `dive` | Coming down nose-first — the bow buried, the pitch-down, the wall over the rider, the crater and the ring on the water |
| `capsize` | Past vertical and still rolling — the sheet off the side, the boil round a hull on its back, the righting (`--t 0.4`, `--t 1.2`, `--t 2.2`) |
| `offshore` | Riding out to sea in wind — the sea building with fetch |
| `backflip` | Held back off a big ramp — the one rotation the air control must reach |

**A new player-visible feature earns a scene in the same change** — a
`RunMoment` + script in `scenarios.ts`, a row in the harness, a case in
`tests/scenarios_test.ts`. A surface no scene captures is a surface no future
sweep will ever look at.

**A scene is stood at, never driven to.** Under software rendering the run
advances at a fraction of wall time, so a scene that drives a kilometre to
its moment is minutes per attempt — which is what turns a wrong guess into a
ten-minute wrong guess, several times over. `placeRun` puts the craft where
the shot wants it with the clock, the gates and the sea state reading as
though it had ridden there; the script then plays the seconds that make the
moment. Wait on the RUN's clock (`t`), never the wall's.

**A HUD element REMOVED owes a grep of the harness.** The harness waits on
`__SH_READY__` and then on nothing else, but a scene that reads a HUD class
to confirm its moment (the air-time chip for `apex`) hangs for its full
timeout and fails with the scene's name, never the selector's. `grep
scripts/screenshot.mjs` for the class before deleting it.

## Running

```sh
make build
CHROMIUM_PATH=/opt/pw-browsers/chromium make screenshots               # every scene, minutes
CHROMIUM_PATH=/opt/pw-browsers/chromium make screenshots SCENE=launch  # one
CHROMIUM_PATH=/opt/pw-browsers/chromium make screenshots SCENE=launch SEED=42 CRAFT=marlin
```

**Look at the PNGs with the Read tool** — every judgement is made on a
screenshot, not on source. Watch the harness's `[pageerror]` lines too: a
clean screenshot over a page error is a lie.

### MEASURE the moment before writing a scene for it

A scene that waits for a moment the level never produces shows a craft
cruising and tells you nothing about why. Before tuning a scenario's script —
and certainly before tuning it twice — run it on the bench: `make ride
SCENARIO=<name>` prints, per cell, speed, pitch, wetted share, rpm and air
time, which answers the questions guessing cannot: did the craft ever leave
the water, did the swell ever reach the height the scene assumes, was the
"carve" a straight line because the throttle was off. The general shape:
when a scene disappoints, the question is not "is the shutter too early" but
"does this moment exist at this seed at all".

### Two traps

- **A canvas is not proof of a running game.** The canvas paints from frame
  one; a static frame with plausible HUD chrome can still mean the loop
  died. Check for the HUD's live numbers (the clock advancing between two
  `t` values) and the `[pageerror]` log before trusting a frame.
- **The sea is a function of `t`.** Two screenshots of the same scene at the
  same `t` are the same sea, which is what makes a before/after honest; two
  at different `t` are different waves, and a "the swell got bigger" read
  between them is the clock, not the change.

## Evaluating

Judge each screenshot against the game's own bar (the `game-feel` skill owns
the reference):

- **The water reads as water.** Depth-coloured, a specular on the crests, a
  wake behind the craft, and the surface the hull sits IN — never a hull
  floating a hand's breadth above the mesh, never one buried in it. That
  gap is the one visible way the engine and the renderer can disagree, and
  it is a bug in whichever is not calling the engine's `surfaceAt`.
- **The hull's attitude reads.** In `chop` the bow pitches; in `carve` the
  craft banks in; in `launch` the nose is up and the jet is dry; in `dive`
  the bow is under.
- **Speed reads.** The wake, the spray, the shore streaming past, the speedo
  climbing — `cruise` should look fast at both viewports.
- **The HUD is legible over the world** — over foam and over deep water both.
- **Portrait is a real game, not a cropped landscape.** The lever and the
  handlebar reachable, the HUD scaled, the next gate visible far enough
  ahead to aim.
- **Nothing regressed in the scenery** — the shore continuous, the skerries
  where the plan put them, the ring where the ramp throws, no z-fighting
  where the terrain meets the water.

For feel questions (the lever's response, the lean's authority, the turn's
bite), run headed: `npm run dev` and ride. A screenshot cannot judge an input
curve.

## Skill self-improvement

Load the **`skill-reflection`** skill before this session commits. A settled
visual rule of thumb ("spray must show in every chop shot", "the HUD fails
over foam at noon") is exactly the kind of thing worth recording — read the
past ones before you evaluate, not after.
