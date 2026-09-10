#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// RENDER-COST METER for the build-and-iterate loop: serves the built app,
// stands it at a staged moment in headless Chromium, and reports what one
// frame actually costs the renderer — draw calls, triangles, program and
// texture binds, and the JavaScript time a frame spends before it hands
// over to the GPU.
//
//   node scripts/profile-render.mjs                 # every scene below
//   node scripts/profile-render.mjs --scene launch  # one
//   node scripts/profile-render.mjs --seed 7 --craft otter
//
// Two sources, both read when they are there:
//   - the WebGL context itself, patched before any page script runs, so
//     every drawElements/drawArrays/useProgram/bindTexture is counted
//     whatever the renderer is (the numbers a real GPU sees);
//   - `window.__SH_STATS__`, the app's own renderer stats when the app
//     exposes them (three's `renderer.info`: calls, triangles, geometries,
//     textures) — printed beside the patched count as a cross-check.
//
// READ THE DRAW CALLS FIRST. Headless Chromium rasterizes in software, so
// the frame RATE here says nothing about a real machine — but draw calls,
// triangles and binds are the same numbers the GPU would see. Judge a
// change structurally (a new pass? a new material? or only an instance
// count?) before reading a small movement as a regression.
//
// Needs a built pwa/dist, a Chromium (CHROMIUM_PATH or
// /opt/pw-browsers/chromium) and playwright-core installed beside the
// tree (`npm install --no-save playwright-core@1` — deliberately not a
// dependency). WITHOUT THEM IT IS A STUB: it prints what it would measure
// and exits 0, so `make profile` never fails a machine for lacking a
// browser.

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "./lib/cli.mjs";
import { serveDir } from "./lib/serve-dist.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "pwa", "dist");

/** The scenes metered: the frame the game is played at, the biggest sea,
 * a flight (the camera pulls back and the water mesh shows most), and the
 * still start. */
const SCENES = ["cruise", "offshore", "launch", "rest"];

const args = parseArgs(
  process.argv.slice(2),
  {
    scene: { kind: "string", help: `only this scene (${SCENES.join(", ")})` },
    seed: { kind: "number", default: 38, help: "level seed" },
    craft: { kind: "string", default: "skiff", help: "craft id" },
    window: { kind: "number", default: 6, help: "seconds metered per scene" },
    // THE PICTURE ROWS (pwa/src/game/settings-video.ts). The whole point of a
    // picture ladder is what it costs, and this is where that is read: the
    // same scene metered at two stops of one row is the only honest answer to
    // "what does HIGH buy and what does it charge".
    water: { kind: "string", help: "the WATER row: low, medium, high" },
    res: { kind: "string", help: "the RESOLUTION row: low, medium, high" },
    detail: { kind: "string", help: "the DETAIL row: low, medium, high" },
    distance: { kind: "string", help: "the DISTANCE row: low, medium, high" },
    see: { kind: "string", help: "see into the water: 1 or 0" },
    fps: { kind: "string", help: "the FRAME RATE row: 30, 60, max" },
    timeout: { kind: "number", default: 30, help: "seconds to wait for window.__SH_READY__" },
  },
  "usage: node scripts/profile-render.mjs [--scene name] [--seed n] [--craft id] [--window s] " +
    "[--water l] [--res l] [--detail l] [--distance l] [--see 0|1] [--fps f] [--timeout s]",
);
const scenes = args.scene ? [args.scene] : SCENES;

/** Counts every draw the page makes, installed before any page script
 * runs so it catches the context three.js creates. A FRAME is an
 * animation callback that drew something — not a `gl.clear` (three clears
 * once per render, and a frame may render more than once) and not a bare
 * callback (loops that never touch the context would divide the cost of a
 * frame by the number of things that happened alongside it). */
const METER = `
window.__meter = { draws: 0, tris: 0, frames: 0, programs: 0, textures: 0, cpu: 0 };
window.__built = { textures: 0, bytes: 0 };
const patch = (proto) => {
  if (!proto) return;
  const m = window.__meter;
  const wrap = (name, count) => {
    const inner = proto[name];
    if (!inner) return;
    proto[name] = function (...a) { m.draws++; m.tris += count(a); return inner.apply(this, a); };
  };
  wrap("drawElements", (a) => a[1] / 3);
  wrap("drawArrays", (a) => a[2] / 3);
  wrap("drawElementsInstanced", (a) => (a[1] / 3) * a[4]);
  wrap("drawArraysInstanced", (a) => (a[2] / 3) * a[3]);
  const useProgram = proto.useProgram;
  proto.useProgram = function (...a) { m.programs++; return useProgram.apply(this, a); };
  const bindTexture = proto.bindTexture;
  proto.bindTexture = function (...a) { m.textures++; return bindTexture.apply(this, a); };
  for (const name of ["texImage2D", "texSubImage2D", "texStorage2D"]) {
    const inner = proto[name];
    if (!inner) continue;
    proto[name] = function (...a) { window.__built.textures++; return inner.apply(this, a); };
  }
  const bufferData = proto.bufferData;
  proto.bufferData = function (...a) {
    const src = a[1];
    window.__built.bytes += typeof src === "number" ? src : (src?.byteLength ?? 0);
    return bufferData.apply(this, a);
  };
};
patch(window.WebGL2RenderingContext && window.WebGL2RenderingContext.prototype);
patch(window.WebGLRenderingContext && window.WebGLRenderingContext.prototype);
const raf = window.requestAnimationFrame.bind(window);
window.requestAnimationFrame = (cb) => raf((t) => {
  const m = window.__meter;
  const drawn = m.draws;
  const t0 = performance.now();
  cb(t);
  const spent = performance.now() - t0;
  if (m.draws === drawn) return;
  m.frames++;
  m.cpu += spent;
});
`;

function stub(reason) {
  console.log(`profile — STUB: ${reason}`);
  console.log(
    "it would serve pwa/dist, open ?seed=&craft=&scene=&shot=0 for each of " +
      `${scenes.join(", ")}, wait for window.__SH_READY__, then meter ${args.window} s of frames:`,
  );
  console.log("  per frame: draw calls, triangles, useProgram and bindTexture binds, JS ms, fps");
  console.log("  per scene: texture uploads and MB of geometry since the page loaded");
  console.log("  plus window.__SH_STATS__ (the app's own renderer.info) when the app exposes it");
  process.exit(0);
}

if (!existsSync(join(dist, "index.html"))) stub(`no built site at ${dist} (run \`npm run build\`)`);
let chromium;
try {
  ({ chromium } = await import("playwright-core"));
} catch {
  stub("playwright-core is not installed (`npm install --no-save playwright-core@1`)");
}
const executablePath = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
if (!existsSync(executablePath)) stub(`no Chromium at ${executablePath} (set CHROMIUM_PATH)`);

const site = await serveDir(dist);
const browser = await chromium.launch({ executablePath });
console.log(`profile — seed ${args.seed}, ${args.craft}, 1280×720, ${args.window} s per scene`);

const rows = [];
for (const scene of scenes) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const problems = [];
  page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
  await page.addInitScript(METER);
  // `shot=0`: the run keeps moving, which is what a frame costs when
  // played rather than photographed.
  const params = new URLSearchParams({
    seed: String(args.seed),
    craft: args.craft,
    scene,
    shot: "0",
  });
  for (const row of ["water", "res", "detail", "distance", "see", "fps"]) {
    if (args[row] !== undefined) params.set(row, String(args[row]));
  }
  await page.goto(`${site.url}?${params}`, { waitUntil: "load" });
  try {
    await page.waitForFunction("window.__SH_READY__ === true", null, {
      timeout: args.timeout * 1000,
    });
  } catch {
    console.log(`  ${scene}: window.__SH_READY__ never went true in ${args.timeout} s — skipped`);
    for (const p of problems) console.log(`   ${p}`);
    await page.close();
    continue;
  }
  await page.evaluate(`
    for (const k of Object.keys(window.__meter)) window.__meter[k] = 0;
    window.__meterFrom = performance.now();
  `);
  await page.waitForTimeout(args.window * 1000);
  const m = await page.evaluate(
    "({ ...window.__meter, built: { ...window.__built }, wall: performance.now() - window.__meterFrom, app: window.__SH_STATS__ ?? null })",
  );
  await page.close();
  const frames = Math.max(1, m.frames);
  rows.push({
    scene,
    frames: m.frames,
    fps: m.frames / (m.wall / 1000),
    draws: m.draws / frames,
    tris: m.tris / frames,
    programs: m.programs / frames,
    textures: m.textures / frames,
    cpu: m.cpu / frames,
    built: m.built,
    app: m.app,
  });
  console.log(`  ${scene}: ${m.frames} frames metered`);
  for (const p of problems) console.log(`   ${p}`);
}

const num = (v, d = 0) => Number(v).toLocaleString("en-US", { maximumFractionDigits: d });
const COLS = [
  ["scene", (r) => r.scene, 10],
  ["draws", (r) => num(r.draws), 8],
  ["tris", (r) => num(r.tris), 10],
  ["useProg", (r) => num(r.programs), 8],
  ["bindTex", (r) => num(r.textures), 8],
  ["cpu ms", (r) => num(r.cpu, 1), 8],
  ["fps", (r) => num(r.fps, 1), 6],
];
console.log(`\n${COLS.map(([h, , w]) => h.padStart(w)).join("")}`);
for (const r of rows) console.log(COLS.map(([, get, w]) => get(r).padStart(w)).join(""));
if (rows.length) {
  console.log("\nbuilding one level, cumulative since the page loaded:");
  for (const r of rows) {
    console.log(
      `  ${r.scene.padEnd(9)} ${num(r.built.textures).padStart(6)} texture uploads` +
        `  ${num(r.built.bytes / 1e6, 1).padStart(7)} MB of geometry`,
    );
  }
  const withApp = rows.filter((r) => r.app);
  if (withApp.length) {
    console.log("\nthe app's own window.__SH_STATS__ (last frame):");
    for (const r of withApp) console.log(`  ${r.scene.padEnd(9)} ${JSON.stringify(r.app)}`);
  } else {
    console.log(
      "\nwindow.__SH_STATS__ is not exposed by this build; only the patched context was read.",
    );
  }
}
console.log("\ndraws/tris/binds are per frame and hardware-independent — judge a change on those.");
console.log("fps is software rasterization and comparable only against another run here.");

await browser.close();
await site.close();
