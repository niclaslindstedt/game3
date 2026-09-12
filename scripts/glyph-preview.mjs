#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GLYPH LAB — every mark the menus draw, at the three sizes it is read
// at, as one labelled contact sheet: `previews/glyphs.png`.
//
// A screenshot of the front door cannot review a mark. It gives back one
// glyph, at one size, beside three others and over moving water — so a
// silhouette that has gone to mush at the size a phone draws it comes back
// looking like a card that is fine. The marks are a SET — each has to be
// told apart from the others at a glance, and every one of them has to
// survive being fourteen pixels tall — and a set is judged side by side.
//
// The page does the work (`pwa/src/tools/glyph-preview.tsx`); this drives
// it. Browser-driven, so it needs a Chromium — `CHROMIUM_PATH` overrides
// discovery, exactly as `scripts/screenshot.mjs` does — and it builds its
// own one-off bundle rather than reading `pwa/dist`, because the harness
// page is not part of the app's build and is never deployed.
//
//   node scripts/glyph-preview.mjs
//   node scripts/glyph-preview.mjs --skip-build      # reuse the last bundle

import { existsSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "./lib/cli.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".glyph-preview");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 60, help: "how long the sheet may take to draw, s" },
    out: {
      kind: "string",
      default: join(outDir, "glyphs.png"),
      help: "where the sheet is written",
    },
  },
  "usage: node scripts/glyph-preview.mjs [--skip-build]",
);

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "glyph-preview.html"))) {
  const { build } = await import("vite");
  await build({
    configFile: false,
    logLevel: "warn",
    root: join(root, "pwa"),
    base: "./",
    esbuild: { jsx: "automatic", jsxImportSource: "preact" },
    build: {
      outDir: buildDir,
      emptyOutDir: true,
      // The app stylesheet carries Tailwind at-rules that only the app's own
      // vite config knows how to expand; this page builds without that
      // config, and minifying them raises a page of warnings about rules it
      // does not need to touch. Nothing here ships, so leave the CSS alone.
      cssMinify: false,
      rollupOptions: { input: join(root, "pwa", "glyph-preview.html") },
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
  const file = join(buildDir, path === "/" ? "glyph-preview.html" : path.slice(1));
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
// Twice the pixels, because what is being judged is a 14px drawing.
const page = await browser.newPage({ viewport: { width: 780, height: 600 }, deviceScaleFactor: 2 });

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

await page.goto(`http://127.0.0.1:${port}/glyph-preview.html`);
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

const marks = await page.locator(".cell").count();
if (marks === 0) throw new Error("no glyphs rendered — check pwa/src/tools/glyph-preview.tsx");
// The sheet grows a row every time a mark is added, and an element screenshot
// only paints what the VIEWPORT could have shown — past that the capture is
// the page's flat backdrop, so the newest marks are exactly the ones that go
// missing. Stand the window as tall as the grid before taking the picture.
const grid = await page.locator(".grid").boundingBox();
if (grid) await page.setViewportSize({ width: 780, height: Math.ceil(grid.height) + 40 });
// The grid rather than the page: a sheet with half a screen of empty plate
// under it is half a sheet of nothing to look at.
await page.locator(".grid").screenshot({ path: args.out });
console.log(`${args.out} (${marks} marks)`);

await browser.close();
server.close();
