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
//     `t` seconds into it; `shot=1` asks for a still — no HUD animation
//     waiting on a clock, no update toast.
//   window.__SH_READY__ === true
//     set by the app once the world is built and the staged frame has
//     been drawn. This tool waits for it (30 s, then a clear error).
//
//   node scripts/screenshot.mjs --scene launch             # one scene
//   node scripts/screenshot.mjs --all                      # every scene
//   node scripts/screenshot.mjs --scene dive --seed 7 --craft otter
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
 * under the `@engine` alias and a list of eleven words is not worth the
 * loader hook; `--all` with a name the app does not know prints the app's
 * own error in the console lines below the capture. */
const SCENES = [
  "rest",
  "cruise",
  "carve",
  "chop",
  "swell",
  "launch",
  "apex",
  "landing",
  "dive",
  "offshore",
  "backflip",
];

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
    wind: { kind: "number", help: "override the wind speed, m/s" },
    hs: { kind: "number", help: "quote the sea by its significant height, m" },
    viewport: { kind: "string", default: "all", help: "desktop, phone or all" },
    timeout: { kind: "number", default: 30, help: "seconds to wait for window.__SH_READY__" },
  },
  "usage: node scripts/screenshot.mjs [--scene name | --all | --drive W:4] [--seed n] [--craft id] [--t s] [--wind m/s] [--hs m] [--viewport v] [--timeout s]",
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
async function capture(name, params, viewportName, script) {
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
    await page.waitForFunction("window.__SH_READY__ === true", null, {
      timeout: args.timeout * 1000,
    });
    await page.screenshot({ path: file });
    console.log(`previews/shot-${name}-${viewportName}.png  ← ${url}`);
  } catch (err) {
    failures += 1;
    const ready = await page.evaluate("window.__SH_READY__").catch(() => undefined);
    console.error(
      `!! ${name} (${viewportName}): ${err.message.split("\n")[0]}` +
        ` — window.__SH_READY__ is ${String(ready)} after ${args.timeout} s; ` +
        `the app has to set it true once the staged frame is drawn (${url})`,
    );
  }
  for (const p of problems) console.log(`   ${p}`);
  await page.close();
}

const base = { seed: String(args.seed), craft: args.craft, shot: "1" };
if (args.wind !== undefined) base.wind = String(args.wind);
if (args.hs !== undefined) base.hs = String(args.hs);
if (args.drive) {
  // A plain run, a key held: `--drive W:4` is four seconds of throttle
  // from the start line, and whatever the sea did in those seconds.
  const [key, secs] = String(args.drive).split(":");
  const hold = Number(secs ?? 3) * 1000;
  for (const v of viewports) {
    await capture(`drive-${key.toLowerCase()}${secs ?? 3}`, base, v, async (page) => {
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
    for (const v of viewports) await capture(scene, params, v);
  }
}

await browser.close();
await site.close();
if (failures > 0) {
  console.error(`\n${failures} capture(s) failed`);
  process.exit(1);
}
