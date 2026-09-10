---
name: lab-tooling
description: "Use when writing or changing a LAB, a PREVIEW or any script under `scripts/` — a new Make target, a new flag on an existing one, a picture drawn in pure Node, a contact sheet drawn in a browser, a scratch probe over the built site, a meter. Owns the shelf every tool is built from (`scripts/lib/`: the flag parser, the raster and the PNG encoder, the `@engine` alias, the static server), the harness-page pattern for a lab that has to DRAW to answer its question, the rule that a lab reads the game's own modules and never restates one, the URL contract the built app answers to, and where a new tool is registered (the Makefile, `package.json`, the README's Usage table, the router's labs table). Load it BEFORE writing a one-off script: what you need is usually on the shelf."
---

# Lab tooling — how a measurement is built here

This project is tuned by measuring and LOOKING, and every subject skill ends
with a lab: `make waves`, `make ride`, `make level`, `make crafts`, `make sky`,
`make flora`, `make audition`, `make screenshots`, `make profile`, `make sim`.
They are all built from ONE shelf, and the shelf is the reason a new lab is an
afternoon rather than a week — and the reason a session that writes its own
PNG encoder, its own flag parser or its own static server has reinvented
something that was already three imports away.

**Read this skill's lessons first** — `node scripts/skill-lessons.mjs
lab-tooling --list`. Load **`skill-reflection`** at both ends of the session
and **`write-code`** beside this one (its rules on `--experimental-strip-types`
and `aliasEngine` are the ones a script trips on first). The subject skill
says what the lab must SHOW; this one says how it is built.

## Two kinds of lab, and which to build

| Kind | Runs in | Costs | Answers |
| --- | --- | --- | --- |
| **Pure Node** — loads the engine (and, through the alias, an app module), draws with `scripts/lib/draw.mjs`, writes a PNG and a table | `node --experimental-strip-types`, no build, no browser | seconds | anything that is NUMBERS or GEOMETRY: a transect, a ride strip, a level map, a craft's triangles, a sim table |
| **Browser-driven** — serves a page in headless Chromium and screenshots or meters it | Playwright over Chromium (`CHROMIUM_PATH`), often `make build` first | tens of seconds to minutes | anything that is LIGHT: a shader, a sky, a canopy, the HUD, what a frame costs |

**Build the pure-Node lab whenever the question can be asked of the engine.**
It runs on CI without a browser, it runs on every seed in a loop, and it
cannot photograph a stale build. The browser lab exists for what only the GPU
can answer, and there are two shapes of it:

- **The built site** (`scripts/screenshot.mjs`, `profile-render.mjs`,
  `audition.mjs --meter`): `scripts/lib/serve-dist.mjs` serves `pwa/dist/` on
  a real origin, the tool opens the app at a URL that stands the run at a
  moment, waits for `window.__SH_READY__`, and shoots or meters. **`make
  build` first, every time** — a stale dist photographs the last change.
- **A harness page** (`make sky`, `make flora`): a page of its own under
  `pwa/src/tools/<name>.ts` with `pwa/<name>-preview.html` beside it, built
  by the driver into a one-off bundle (so no `make build`), that lays the
  subject out as a LADDER — every weather against every hour, every species
  at both ends of its height band — with the game's own modules and the
  game's own lights. Vite builds only `index.html`, so a harness never ships.
  Build one when a screenshot of a RUN can only ever show one cell of a
  ladder that is judged side by side or not at all.

## The shelf: `scripts/lib/`

| Module | Gives every tool |
| --- | --- |
| `cli.mjs` | THE COMMAND LINE, once: `parseArgs(argv, spec)` from one table of flags — `--help` that prints every flag with its default, a non-zero exit on a flag it does not know (a measurement tool that ignores a mistyped flag reports a confident wrong number), `--name=value` and `--name value` both, positionals in `_` |
| `draw.mjs` | A SMALL RASTER: an RGBA buffer, a filled box, a line, a circle, a polyline, a label in a 5×7 bitmap font (upper case — a caption is a tag), alpha blending so a transect can be drawn a dozen moments deep; `toPng()` through `png.mjs` |
| `png.mjs` | The PNG encoder — zlib only, no native image dependency; the icon generator uses the same one |
| `engine-alias.mjs` | `aliasEngine()` — a resolve hook that hands `@engine` to `engine/index.ts` so a plain-Node script can `import()` an APP module (`scenarios.ts`, `craft-body.ts`, `flora-plan.ts`) instead of restating its table. Call it BEFORE the dynamic import. three.js geometry loads in plain Node under it, so a lab can paint the builder's exact triangles |
| `serve-dist.mjs` | `serveDir(dir)` — the built site on a real origin on a free port, as deployed (directory → `index.html`, unknown path → 404), because the service worker, the manifest and `localStorage` all behave differently off `file://` |
| `level-draw.mjs`, `ride-draw.mjs` | The two schematic painters (a level from above, a ride in profile), reused by anything that wants a level or a hull in a picture |
| `ride-scenarios.mjs` | The ride lab's staged moments — a `RunMoment` and a scripted input each. Named separately from the app's `scenarios.ts`; a scenario added to one is added to both |

And the `scripts/` entries themselves are the worked examples: `waves-lab.mjs`
for a three-panel pure-Node picture with a table, `level-map.mjs` for a lab
that also emits `--json`, `craft-preview.mjs` for an app module through the
alias, `sky-preview.mjs` for a harness page and its one-off bundle,
`screenshot.mjs` for driving the built site, `profile-render.mjs` for a
meter, `audition.mjs` for a page written by concatenation.

## The URL contract

A browser lab does not click through menus. `pwa/src/App.tsx` reads a query
string that stands the app exactly where the tool wants it, and
`scripts/screenshot.mjs`'s `--help` is the list: a scene and its `t`
(`?seed=&craft=&scene=&t=&shot=1` — `shot=1` freezes the frame once drawn), a
menu surface (`?menu=`), a start-card override (`?start=`), the hour, the
season and the weather in place of the level's, a camera rung, every row of
OPTIONS ▸ VIDEO, `?update=1` for the new-build button. **The writer and the
reader move together**: a parameter added to a tool is read in `App.tsx` in
the same change, documented in `docs/configuration.md`, and proved by running
the tool. Readiness is `window.__SH_READY__`; before it the loading card is
up and every keystroke is dropped, so a probe that holds a key reads a clean
zero and calls the feature broken.

Two things a still cannot do, and `playtest` owns the workarounds: catch a
beat under a second of sim time under software rendering, and see a twitch
that only shows when ridden.

## Craft rules

- **A lab reads the game's own modules and restates nothing.** The physics'
  waterline on the craft sheet is `restY`; the ramp on the level map is
  `rampSurface`; the sky sheet is `skyAt`. A number typed into a script is a
  number that is wrong the day the model moves, silently. If the module is
  under `pwa/src/`, that is what `aliasEngine` is for; if a value is not on
  the engine's public surface, import the module that owns it and say so in
  a comment rather than copying the arithmetic.
- **A lab prints its inputs beside its outputs.** The seed, the craft, the
  wind, the flags in force — on the picture's title and in the table — so a
  PR's before/after can be checked to be the same measurement.
- **Every tool parses through `cli.mjs`.** A hand-rolled `process.argv`
  scan is a tool with no `--help` and no unknown-flag exit, and §12 asks for
  both.
- **`--experimental-strip-types` erases types and refuses anything that
  emits code**: no enums, no parameter properties, no namespaces in anything
  a script imports. The first sign is a lab dying with
  `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` on an import three files from the
  change; neither `make lint` nor `make test` catches it, so run the lab.
- **Output goes to `previews/`**, gitignored, named after the subject and its
  inputs (`level-38.png`, `waves-38.png`, `ride-launch.png`, `sky.png`), never
  committed. A picture that should survive goes in the PR.
- **A browser lab takes `CHROMIUM_PATH`** the way `screenshot.mjs` does, and
  without a Chromium it says what it would have measured and exits 0 — CI
  runs the pure-Node labs, not the browser ones.
- **A browser lab drives the BUILT site or its own bundle, never `npm run
  dev`.** The dev server has no service worker and a different base path;
  what it photographs is not what ships.
- **A scratch probe is a lab you did not register.** Ten lines over
  `serveDir` and `playwright-core` — a `deviceScaleFactor: 3` capture clipped
  to the stern, a `page.evaluate` that reads a counter off `window` — are
  legitimate and worth writing; keep them OUT of the commit — under
  `previews/`, which is gitignored and inside the tree, because a bare
  `import "playwright-core"` only resolves from a file under the repo's own
  `node_modules` (a script in a scratch directory dies with
  `ERR_MODULE_NOT_FOUND`) — and if the same probe is written twice, it is a
  flag on the tool it duplicates.
- **A lab that has to draw the WORLD reuses the renderer's builders**, with
  the game's own hemisphere and key at `environment.ts`'s angles, or the
  sheet lies about what a run will show.

## Registering a tool

A tool exists when a session that has never seen it can find it. One change,
all of these:

1. `scripts/<name>.mjs` with a header saying what question it answers and
   the commands to run it; `#!/usr/bin/env node`; flags through `cli.mjs`.
2. `package.json`: `"<name>": "node --experimental-strip-types
   --disable-warning=ExperimentalWarning scripts/<name>.mjs"` for a pure-Node
   lab; a plain `node scripts/<name>.mjs` for a browser one.
3. The `Makefile`: a target with a comment saying what it draws and the
   example invocations, mapping `SEED=`, `CRAFT=`, `SCENE=` and `ARGS=` onto
   the flags the way its neighbours do.
4. `README.md`'s Usage table — one row, what it does, where it writes.
5. `AGENTS.md`'s labs table, if a subject now OWES the lab before and after
   a change, and the owning skill's own workflow.
6. For a harness page: `pwa/src/tools/<name>.ts`, `pwa/<name>-preview.html`
   (with `noindex` and a comment saying it never ships), and the driver's
   one-off build.

Then run `--help`, run it once with no flags and once with every flag, and
put the picture in the PR.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. Worth a fragment
here: a thing the shelf turned out not to have, a probe written twice, a URL
parameter that was read but never documented.
