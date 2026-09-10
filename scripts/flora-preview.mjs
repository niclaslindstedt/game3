#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FLORA LAB — every species on the coast, side by side, as one labelled
// contact sheet: `previews/flora.png`.
//
// A screenshot of a RUN cannot review a roster. It gives back whichever
// species that stretch of shore happened to grow, at whatever range the
// craft happened to be, against a wood of everything else — so a reed that
// is too pale and a rowan that is the wrong shape both come back as "the
// shore looks fine". The roster is a ladder (a birch reads lighter than a
// pine, a sallow softer than an alder) and a ladder is judged side by side.
// Each cell draws its species at both ends of its own height band over a
// metre rule, so the sheet answers the shape and the size at once.
//
// The page does the work (`pwa/src/tools/flora-preview.ts`); this drives
// it. Browser-driven, so it needs a Chromium — `CHROMIUM_PATH` overrides
// discovery, exactly as `scripts/screenshot.mjs` does — and it builds its
// own one-off bundle rather than reading `pwa/dist`, because the harness
// page is not part of the app's build and is never deployed.
//
//   node scripts/flora-preview.mjs
//   node scripts/flora-preview.mjs --rows=reed,sedge,alder
//   node scripts/flora-preview.mjs --skip-build      # reuse the last bundle

import { existsSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "./lib/cli.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".flora-preview");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    rows: { kind: "string", default: "", help: "only these species (e.g. reed,birch,pine)" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 600, help: "how long the sheet may take to draw, s" },
    out: { kind: "string", default: join(outDir, "flora.png"), help: "where the sheet is written" },
  },
  "usage: node scripts/flora-preview.mjs [--rows=…] [--skip-build]",
);

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "flora-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "flora-preview.html") },
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
  const file = join(buildDir, path === "/" ? "flora-preview.html" : path.slice(1));
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

// A PAGE ERROR IS FATAL HERE, AND IT HAS TO SAY SO: the harness signals it
// has finished by setting `window.__done`, so a module that threw simply
// never sets it and the wait below burns its whole timeout before failing
// with nothing but "timed out", which reads as a slow machine.
let crashed = null;
page.on("pageerror", (err) => {
  crashed ??= err;
  console.error(`[pageerror] ${err.message}`);
});
page.on("console", (msg) => {
  if (msg.type() === "error") console.error(`[console] ${msg.text()}`);
});

const query = new URLSearchParams(
  Object.entries({ rows: args.rows }).filter(([, v]) => v),
).toString();
const url = `http://127.0.0.1:${port}/flora-preview.html${query ? `?${query}` : ""}`;
console.log(`flora — ${args.rows || "every species"} on the taiga coast`);
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
