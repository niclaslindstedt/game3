#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WAKE LAB — the trail from straight above, one column a moment along a
// scripted run, as one labelled contact sheet: `previews/wake.png`.
//
// The game has no view of its own trail. Every camera on the ladder is a
// chase camera, so the wake is only ever seen end-on, down its own length,
// foreshortened to a stripe — while every reference photograph of a wake
// ever taken is from straight above. A V that stops opening too early, a
// road twice the width it should be and a scallop that crawls with the
// craft instead of standing still in the water all look much the same from
// behind, which is how each of them shipped.
//
// So the sheet draws the MAP — the trail rasterised from directly overhead,
// which IS the plan view and is the very data the water shader reads. Left
// to right is time, so the sheet reads as the trail being LAID: the jet
// blasting astern off a standing start, the road catching up as the hull
// begins to move, the fan opening behind it. `--channels` adds one row per
// channel underneath, which is what says whether a mark is missing from the
// map or merely invisible in it.
//
// The page does the work (`pwa/src/tools/wake-preview.ts`); this drives it.
// It is browser-driven, so it needs a Chromium — `CHROMIUM_PATH` overrides
// discovery, exactly as `scripts/screenshot.mjs` does — and it builds its
// own one-off bundle rather than reading `pwa/dist`, because the harness
// page is not part of the app's build and is never deployed.
//
// `--profile` adds the two rows a plan view cannot carry: the water surface
// in SECTION, along the craft's axis astern and across the trail at four
// distances back, probed through the water shader's own relief functions.
// It is the only view in the repo that says whether the sea actually BENDS
// for the craft, as against merely whitening.
//
//   node scripts/wake-preview.mjs
//   node scripts/wake-preview.mjs --drive=carve        # the turn's shoulder
//   node scripts/wake-preview.mjs --channels           # foam/churn/crest/hollow
//   node scripts/wake-preview.mjs --profile            # the surface, in section
//   node scripts/wake-preview.mjs --times=0.1,0.3,0.6  # the first moments
//   node scripts/wake-preview.mjs --skip-build         # reuse the last bundle

import { existsSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "./lib/cli.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".wake-preview");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 38, help: "level seed" },
    craft: { kind: "string", default: "skiff", help: "which craft lays the trail" },
    drive: {
      kind: "string",
      default: "start",
      help: "what the rider does: start (throttle from rest), carve, brake",
    },
    times: { kind: "string", default: "", help: "seconds into the run to draw (e.g. 0.2,1,4)" },
    channels: { kind: "flag", help: "a row per channel under the composite" },
    profile: {
      kind: "flag",
      help: "two section rows under the maps: the surface along the axis and across it",
    },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 600, help: "how long the sheet may take to draw, s" },
    out: { kind: "string", default: join(outDir, "wake.png"), help: "where the sheet is written" },
  },
  "usage: node scripts/wake-preview.mjs [--seed=n] [--craft=id] [--drive=…] [--times=…] [--channels]",
);

const DRIVES = ["start", "carve", "brake"];
if (!DRIVES.includes(args.drive)) {
  console.error(`unknown --drive ${args.drive} — one of ${DRIVES.join(", ")}`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "wake-preview.html"))) {
  const { build } = await import("vite");
  await build({
    configFile: false,
    logLevel: "warn",
    root: join(root, "pwa"),
    base: "./",
    resolve: { alias: { "@engine": join(root, "engine", "index.ts") } },
    build: {
      outDir: buildDir,
      emptyOutDir: true,
      rollupOptions: { input: join(root, "pwa", "wake-preview.html") },
    },
  });
}

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
};

const server = createServer(async (req, res) => {
  const path = (req.url ?? "/").split("?")[0];
  const file = join(buildDir, path === "/" ? "wake-preview.html" : path.slice(1));
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const port = server.address().port;

let chromium;
try {
  ({ chromium } = await import("playwright-core"));
} catch {
  console.error("playwright-core is not installed — `npm i --no-save playwright-core`");
  process.exit(1);
}
const executablePath = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
if (!existsSync(executablePath)) {
  console.error(`no Chromium at ${executablePath} — set CHROMIUM_PATH`);
  process.exit(1);
}

const browser = await chromium.launch({ executablePath });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

// A PAGE ERROR IS FATAL HERE, AND IT HAS TO SAY SO. The harness signals it
// has finished by setting `window.__done`, so a module that threw simply
// never sets it — and the wait below then burns its whole timeout before
// failing with nothing but "timed out", which reads as a slow machine. That
// is how a one-line crash in the page sits here looking like the software
// rasterizer being slow.
let crashed = null;
page.on("pageerror", (err) => {
  crashed ??= err;
  console.error(`[pageerror] ${err.message}`);
});
page.on("console", (msg) => {
  if (msg.type() === "error") console.error(`[console] ${msg.text()}`);
});

const query = new URLSearchParams(
  Object.entries({
    seed: String(args.seed),
    craft: args.craft,
    drive: args.drive,
    times: args.times,
    channels: args.channels ? "1" : "",
    profile: args.profile ? "1" : "",
  }).filter(([, v]) => v),
).toString();
const url = `http://127.0.0.1:${port}/wake-preview.html${query ? `?${query}` : ""}`;
console.log(
  `wake — seed ${args.seed}, ${args.craft}, ${args.drive}, ${args.times || "the default moments"}${
    args.channels ? ", every channel" : ""
  }${args.profile ? ", in section" : ""}`,
);
// The harness runs the whole scripted ride synchronously before the page's
// load event can fire — it generates a level and then steps the engine at
// 120 Hz for the length of the run — so the NAVIGATION is as long as the
// sheet and the `--timeout` flag has to cover it too. Left at Playwright's
// own 30 s default this fails as a navigation timeout, which reads as a
// broken page rather than as a ride that is simply longer than it was.
await page.goto(url, { timeout: args.timeout * 1000 });

await Promise.race([
  page.waitForFunction("window.__done === true", undefined, { timeout: args.timeout * 1000 }),
  new Promise((_, fail) => {
    const watch = setInterval(() => {
      if (crashed) {
        clearInterval(watch);
        fail(crashed);
      }
    }, 200);
    watch.unref();
  }),
]);

const stage = await page.$("canvas#stage");
const box = await stage.boundingBox();
await page.setViewportSize({ width: Math.ceil(box.width), height: Math.ceil(box.height) });
await page.screenshot({ path: args.out, fullPage: true });
console.log(args.out.replace(`${root}/`, ""));

await browser.close();
server.close();
