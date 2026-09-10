#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKY LAB — every weather against every hour, on one coast, as one
// labelled contact sheet: `previews/sky.png`.
//
// The sky is the one part of this game a screenshot of a RUN cannot review:
// a seed is dealt one sky (R19) at one hour (R13), so a picture of a run
// says whether THAT sky is wrong and nothing about the ladder it sits on.
// The ladder is the design — the squall has to read heavier than the
// overcast, and the sunrise has to read like a different day from the noon
// — and a ladder is only ever judged side by side. The start card makes
// that sharper still, since a player can now ask for a squall at sunrise,
// which no seed would ever deal.
//
// The page does the work (`pwa/src/tools/sky-preview.ts`); this drives it.
// It is browser-driven, so it needs a Chromium — `CHROMIUM_PATH` overrides
// discovery, exactly as `scripts/screenshot.mjs` does — and it builds its
// own one-off bundle rather than reading `pwa/dist`, because the harness
// page is not part of the app's build and is never deployed.
//
//   node scripts/sky-preview.mjs
//   node scripts/sky-preview.mjs --rows=squall,rain --hours=3.5,12
//   node scripts/sky-preview.mjs --skip-build      # reuse the last bundle

import { existsSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "./lib/cli.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".sky-preview");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    rows: {
      kind: "string",
      default: "",
      help: "only these weathers (clear,high,overcast,rain,squall)",
    },
    hours: { kind: "string", default: "", help: "only these hours (e.g. 3.5,12,20.5)" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 600, help: "how long the sheet may take to draw, s" },
    out: { kind: "string", default: join(outDir, "sky.png"), help: "where the sheet is written" },
  },
  "usage: node scripts/sky-preview.mjs [--rows=…] [--hours=…] [--skip-build]",
);

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "sky-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "sky-preview.html") },
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
  const file = join(buildDir, path === "/" ? "sky-preview.html" : path.slice(1));
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
  Object.entries({ rows: args.rows, hours: args.hours }).filter(([, v]) => v),
).toString();
const url = `http://127.0.0.1:${port}/sky-preview.html${query ? `?${query}` : ""}`;
console.log(`sky — seed 38, ${args.rows || "every weather"} × ${args.hours || "every hour"}`);
await page.goto(url);

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
