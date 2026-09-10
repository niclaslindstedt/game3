#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// SCREENSHOTS of the real build: serves pwa/dist, opens the app in
// headless Chromium at a staged moment, waits for the app to say the
// frame is ready, and captures it at the two reference viewports (§35.2)
// — desktop landscape 1280×720 and phone portrait 390×844 at 2× — into
// the gitignored previews/. The closing step of every gameplay change:
// the sim gives numbers, the ride lab gives a diagram, this gives the
// thing the player receives.
//
// THE CONTRACT WITH THE APP (pwa/src/App.tsx):
//   ?seed=<n>&craft=<id>&scene=<name>&t=<s>&shot=1
//     stands the run at the named scenario (pwa/src/game/scenarios.ts),
//     `t` seconds into it; `shot=1` asks for a still — the frame is frozen
//     once it is drawn, so nothing moves under the shutter.
//   ?update=1 (--update)
//     draws the new-build button as if a newer build were waiting. A real
//     one only ever appears on a device that already had the app, which a
//     fresh browser profile can never be, so this flag is the only way that
//     surface is ever photographed.
//   window.__SH_READY__ === true
//     set by the app once the world is built and the staged frame has
//     been drawn. This tool waits for it (30 s, then a clear error).
//
//   node scripts/screenshot.mjs --scene launch             # one scene
//   node scripts/screenshot.mjs --all                      # every scene
//   node scripts/screenshot.mjs --scene dive --seed 7 --craft otter
//   node scripts/screenshot.mjs --scene rest --update            # the
//        new-build button, which has no other way to be looked at
//   node scripts/screenshot.mjs --drive W:4                # no scene: a
//        plain run from the start with the W key held four seconds, then shot
//
// Needs a built pwa/dist (`npm run build`), a Chromium — CHROMIUM_PATH
// or /opt/pw-browsers/chromium — and playwright-core, which is
// DELIBERATELY not a dependency of this repository: a browser driver is
// a hundred megabytes nobody needs to build or test the game. Install it
// beside the tree with `npm install --no-save playwright-core@1`.

import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "./lib/cli.mjs";
import { serveDir } from "./lib/serve-dist.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "pwa", "dist");
const outDir = join(root, "previews");

/** The scenes the app stages (`SCENARIO_NAMES` in scenarios.ts). Restated
 * here rather than imported because the app module pulls the engine in
 * under the `@engine` alias and a list of sixteen words is not worth the
 * loader hook; `--all` with a name the app does not know prints the app's
 * own error in the console lines below the capture. */
const SCENES = [
  "rest",
  "cruise",
  "carve",
  "brake",
  "chop",
  "swell",
  "launch",
  "apex",
  "landing",
  "dive",
  "offshore",
  "storm",
  "backflip",
  "wildlife",
  "breach",
  "mark",
  "river",
];

/** THE MENU SURFACES, and how to photograph each one.
 *
 * A card is not a staged frame, so these do not wait on `window.__SH_READY__`
 * — that flag is set when a RUN's frame is drawn, and a menu is a card over a
 * sea that is still moving. What says a card is up is the card being in the
 * DOM, so each row names the element to wait for. `settle` is the beat after
 * it that the card's own arrival animation needs before it is worth a
 * picture.
 *
 * The URLs are the app's own (`?splash=`, `?menu=` in App.tsx) — a surface
 * the lab can reach is a surface a bug report can link to. */
const SURFACES = {
  splash: { params: { splash: "1" }, wait: ".splash-title", settle: 900 },
  menu: { params: { menu: "root" }, wait: ".menu-card-root", settle: 1000 },
  // The start card settles slowly on purpose: its chart is a whole level
  // generated in a worker, and the row waits for the arrows to be still
  // before it asks. A short settle photographs "READING THE CHART…".
  start: { params: { menu: "start" }, wait: ".seed-preview", settle: 2600 },
  // The craft card settles slowly too, and for the opposite reason: its
  // three.js turntable is a dynamic chunk, and the hull is built on the
  // frame after that lands. A short settle photographs an empty pane.
  craft: { params: { menu: "craft" }, wait: ".craft-pick-canvas", settle: 2200 },
  options: { params: { menu: "options" }, wait: ".menu-card", settle: 400 },
  developer: { params: { menu: "developer" }, wait: ".menu-card", settle: 400 },
  // The pause card is the one surface with no meaning without a run behind
  // it, so `?paused=1` rides one and holds it — the HUD and the frozen sea
  // under the card are part of the picture, not a backdrop to crop out.
  pause: { params: { paused: "1" }, wait: ".menu-card-pause", settle: 700 },
};

/** The two reference viewports (§35.2). */
const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
};

const args = parseArgs(
  process.argv.slice(2),
  {
    scene: { kind: "string", default: "cruise", help: `which (${SCENES.join(", ")})` },
    all: { kind: "flag", help: "every scene" },
    surface: {
      kind: "string",
      help: `a menu surface instead of a scene (${Object.keys(SURFACES).join(", ")}, all)`,
    },
    seed: { kind: "number", default: 38, help: "level seed" },
    craft: { kind: "string", default: "skiff", help: "craft id" },
    t: {
      kind: "number",
      help: "seconds into the scene to capture (the scene's own when left out)",
    },
    drive: {
      kind: "string",
      help: "KEY:SECONDS — a plain run with a key held that long, then shot",
    },
    update: {
      kind: "flag",
      help: "draw the new-build button (?update=1); the shot is named <scene>-update",
    },
    wind: { kind: "number", help: "override the wind speed, m/s" },
    hs: { kind: "number", help: "quote the sea by its significant height, m" },
    hour: { kind: "number", help: "ride at this hour on the clock in place of the level's" },
    weather: {
      kind: "string",
      help: "ride under this sky (clear, high, overcast, rain, squall) in place of the level's",
    },
    // THE PICTURE ROWS, so a change to one can be photographed at every stop
    // of its own ladder rather than only at the default. `--water high` beside
    // `--water low` on the same scene is how that row is judged at all: the
    // difference is a wave twenty metres out, and no single frame shows it.
    // THE CAMERA LADDER, for the same reason: a rung is judged against the
    // rungs on either side of it, and one frame from the default shows
    // neither. `--camera` names which one the run opens on; the shot is
    // named after it, so a sweep leaves one file per rung.
    camera: {
      kind: "string",
      help: "which camera: bow, nose, close, chase, far, heli",
    },
    water: { kind: "string", help: "the WATER row: low, medium, high" },
    res: { kind: "string", help: "the RESOLUTION row: low, medium, high" },
    detail: { kind: "string", help: "the DETAIL row: low, medium, high" },
    distance: { kind: "string", help: "the DISTANCE row: low, medium, high" },
    see: { kind: "string", help: "see into the water: 1 or 0" },
    viewport: { kind: "string", default: "all", help: "desktop, phone or all" },
    timeout: { kind: "number", default: 30, help: "seconds to wait for window.__SH_READY__" },
  },
  "usage: node scripts/screenshot.mjs [--scene name | --all | --surface name | --drive W:4] " +
    "[--seed n] [--craft id] [--t s] [--update] [--wind m/s] [--hs m] [--hour h] [--weather w] " +
    "[--camera c] [--water l] [--res l] [--detail l] [--distance l] [--see 0|1] " +
    "[--viewport v] [--timeout s]",
);
const viewports =
  args.viewport === "all" ? Object.keys(VIEWPORTS) : String(args.viewport).split(",");
for (const v of viewports) {
  if (!VIEWPORTS[v]) {
    console.error(`unknown viewport "${v}" (${Object.keys(VIEWPORTS).join(", ")}, all)`);
    process.exit(2);
  }
}
if (!existsSync(join(dist, "index.html"))) {
  console.error(`no built site at ${dist} — run \`npm run build\` first`);
  process.exit(2);
}
let chromium;
try {
  ({ chromium } = await import("playwright-core"));
} catch {
  console.error(
    "playwright-core is not installed (it is deliberately not a dependency): " +
      "`npm install --no-save playwright-core@1`",
  );
  process.exit(2);
}
const executablePath = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
if (!existsSync(executablePath)) {
  console.error(`no Chromium at ${executablePath} — set CHROMIUM_PATH`);
  process.exit(2);
}

mkdirSync(outDir, { recursive: true });
const site = await serveDir(dist);
const browser = await chromium.launch({ executablePath });
console.log(
  `screenshots — seed ${args.seed}, ${args.craft}, ${viewports.join("+")}, serving ${dist} at ${site.url}`,
);

let failures = 0;

/** One capture: a page at a viewport, the URL the contract names, the
 * wait for the app's ready flag, the file. Console errors and page errors
 * are printed under the file name: a screenshot of a frame the app threw
 * on is a screenshot of the wrong thing. */
async function capture(name, params, viewportName, script, surface) {
  const { viewport, deviceScaleFactor } = VIEWPORTS[viewportName];
  const page = await browser.newPage({ viewport, deviceScaleFactor });
  const problems = [];
  page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning")
      problems.push(`${msg.type()}: ${msg.text()}`);
  });
  const url = `${site.url}?${new URLSearchParams(params)}`;
  const file = join(outDir, `shot-${name}-${viewportName}.png`);
  try {
    await page.goto(url, { waitUntil: "load" });
    if (script) await script(page);
    if (surface) {
      // A CARD, not a staged frame: what says it is up is the card being in
      // the DOM. See SURFACES for why the ready flag is the wrong question.
      await page.waitForSelector(surface.wait, { timeout: args.timeout * 1000 });
      await page.waitForTimeout(surface.settle);
    } else {
      await page.waitForFunction("window.__SH_READY__ === true", null, {
        timeout: args.timeout * 1000,
      });
    }
    await page.screenshot({ path: file });
    console.log(`previews/shot-${name}-${viewportName}.png  ← ${url}`);
  } catch (err) {
    failures += 1;
    if (surface) {
      console.error(
        `!! ${name} (${viewportName}): ${err.message.split("\n")[0]}` +
          ` — no "${surface.wait}" after ${args.timeout} s (${url})`,
      );
    } else {
      const ready = await page.evaluate("window.__SH_READY__").catch(() => undefined);
      console.error(
        `!! ${name} (${viewportName}): ${err.message.split("\n")[0]}` +
          ` — window.__SH_READY__ is ${String(ready)} after ${args.timeout} s; ` +
          `the app has to set it true once the staged frame is drawn (${url})`,
      );
    }
  }
  for (const p of problems) console.log(`   ${p}`);
  await page.close();
}

const base = { seed: String(args.seed), craft: args.craft, shot: "1" };
if (args.update) base.update = "1";
if (args.camera !== undefined) base.camera = String(args.camera);
if (args.wind !== undefined) base.wind = String(args.wind);
if (args.hs !== undefined) base.hs = String(args.hs);
if (args.hour !== undefined) base.hour = String(args.hour);
if (args.weather !== undefined) base.weather = String(args.weather);
if (args.water !== undefined) base.water = String(args.water);
if (args.res !== undefined) base.res = String(args.res);
if (args.detail !== undefined) base.detail = String(args.detail);
if (args.distance !== undefined) base.distance = String(args.distance);
if (args.see !== undefined) base.see = String(args.see);
if (args.surface) {
  const names = args.surface === "all" ? Object.keys(SURFACES) : String(args.surface).split(",");
  for (const name of names) {
    const surface = SURFACES[name];
    if (!surface) {
      console.error(`unknown surface "${name}" (${Object.keys(SURFACES).join(", ")}, all)`);
      failures += 1;
      continue;
    }
    const params = { seed: String(args.seed), craft: args.craft, ...surface.params };
    for (const v of viewports) await capture(name, params, v, undefined, surface);
  }
} else if (args.drive) {
  // A plain run, a key held: `--drive W:4` is four seconds of throttle
  // from the start line, and whatever the sea did in those seconds.
  const [key, secs] = String(args.drive).split(":");
  const hold = Number(secs ?? 3) * 1000;
  const name = `drive-${key.toLowerCase()}${secs ?? 3}${args.update ? "-update" : ""}`;
  for (const v of viewports) {
    await capture(name, base, v, async (page) => {
      await page.waitForFunction("window.__SH_READY__ === true", null, {
        timeout: args.timeout * 1000,
      });
      await page.evaluate("window.__SH_READY__ = false");
      await page.keyboard.down(key);
      await page.waitForTimeout(hold);
      await page.keyboard.up(key);
      // A held key is a moving frame; the ready flag is re-armed by the
      // app on the next drawn frame, or by us after a beat if it is not.
      await page.waitForTimeout(250);
      await page.evaluate("window.__SH_READY__ = true");
    });
  }
} else {
  const scenes = args.all ? SCENES : [args.scene];
  for (const scene of scenes) {
    const params = { ...base, scene };
    if (args.t !== undefined) params.t = String(args.t);
    // Named apart so a forced button, or a camera off the default rung,
    // never overwrites the plain shot of the same moment — the pair, or the
    // ladder, is what a review compares.
    const name =
      `${scene}${args.camera !== undefined ? `-${args.camera}` : ""}` +
      `${args.update ? "-update" : ""}`;
    for (const v of viewports) await capture(name, params, v);
  }
}

await browser.close();
await site.close();
if (failures > 0) {
  console.error(`\n${failures} capture(s) failed`);
  process.exit(1);
}
