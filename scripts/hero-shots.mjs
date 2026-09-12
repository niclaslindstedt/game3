#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE POSTER SHOTS — the game at its best, staged on purpose.
//
// Every other browser lab here answers a question: does the lip break where
// the model says, what does the cover cost a frame, is the third rung of the
// camera ladder framed like the second. This one answers the question a
// STORE PAGE asks, which is a different question and has never been asked of
// this build: is there a frame in here that makes somebody want to ride it.
//
// It exists as a TABLE rather than as flags because that is the whole value.
// A beauty shot is a dozen numbers agreeing at once — which shore, how big
// the sea is, where the sun stands, what sky is over it, which rung the
// camera is on, how far into the moment the shutter falls — and a session
// that has to rediscover that combination arrives at a grey frame of chop
// and concludes the game is not photogenic. Each row below is one such
// agreement, with a line saying what it is FOR, so the next session starts
// from a picture rather than from the flags.
//
// WHERE THE SUN STANDS IS NAMED AS AN ANGLE, NOT AS AN HOUR. "Low, and
// rising" is the thing a photographer wants; 03:41 is what that means on the
// taiga coast in summer, and 07:52 is what the same thing means in winter.
// So a row names the elevation and this resolves it against the level's own
// coast and season through the engine's own solar model (`hourOfElevation`).
// An hour typed into a table is a table that is wrong for every other season
// and silently wrong the day a second coast lands.
//
// THE HUD IS OFF (`?hud=0`, added to the app's URL contract for this). A
// poster of the sea with a speedo over it is a photograph of the
// instruments.
//
//   npm run hero -- --list             # the table, with what each row is for
//   npm run hero                       # every shot, at poster size
//   npm run hero -- --shot sundown     # one of them
//   npm run hero -- --shot stars --viewport card
//   npm run hero -- --og sundown       # ...and write that one to the share
//                                      # card the site serves (pwa/public/og.png)
//
// Needs a built pwa/dist (`npm run build`), a Chromium — CHROMIUM_PATH or
// /opt/pw-browsers/chromium — and playwright-core, which is deliberately not
// a dependency of this repository: `npm install --no-save playwright-core@1`.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "./lib/cli.mjs";
import { serveDir } from "./lib/serve-dist.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "pwa", "dist");
const outDir = join(root, "previews", "hero");

/**
 * THE SHOTS. Each is a staged moment (`pwa/src/game/scenarios.ts`) plus the
 * conditions that make it worth looking at, and `why` is the row's own
 * argument for existing — delete a row when its argument stops being true,
 * not because a later sweep preferred a different seed.
 *
 * `sun` names where the sun stands: `up` in degrees above the horizon and
 * whether it is `rising` (the same hour comes round twice a day and the sky
 * is not the same colour in both). Negative is below the horizon — about
 * -12° is where the stars are out and the craft's lamp is the only thing on
 * the water. Left out, the level rides at the hour its seed dealt it.
 */
const SHOTS = {
  sundown: {
    why: "the money shot: the open ocean with the sun ON it, the hull a silhouette in the glitter",
    scene: "offshore",
    seed: 38,
    craft: "marlin",
    season: "summer",
    weather: "clear",
    sun: { up: 8, rising: false },
    camera: "far",
    // Stood and shot, not ridden into: the scene aims the hull down the
    // sun's own path, and three seconds of its script is three seconds of
    // drifting off the one thing the frame is about.
  },
  swell: {
    why: "the same light in closer: a long swell running up the shore, the gates lit along it",
    scene: "swell",
    seed: 38,
    craft: "marlin",
    season: "summer",
    weather: "clear",
    sun: { up: 8, rising: false },
    camera: "far",
    t: 3,
  },
  island: {
    why: "the sun going down behind a wooded skerry, its path laid across the water to the bow",
    scene: "birds",
    seed: 38,
    craft: "otter",
    season: "summer",
    weather: "clear",
    // High enough to still be above the wood on the skerry: the trees are
    // twenty metres of it, so a sun ON the horizon is a sun behind them and
    // the picture loses the thing it is about.
    sun: { up: 13, rising: false },
  },
  river: {
    why: "the PLACE rather than the ride: a river between two taiga banks, the wood in the water",
    scene: "river",
    seed: 38,
    craft: "otter",
    season: "summer",
    weather: "clear",
    sun: { up: 13, rising: false },
  },
  flight: {
    why: "the game's own verb: a hull through a ring at the top of its arc, the whole sea under it",
    scene: "apex",
    seed: 38,
    craft: "dart",
    season: "summer",
    weather: "clear",
    sun: { up: 10, rising: false },
    camera: "heli",
  },
  stars: {
    why: "the night: the band overhead, the lamp thrown up the face of a swell, the moon over it",
    scene: "ocean",
    seed: 38,
    craft: "dart",
    // Autumn is where the nights are actually black this far north — a
    // summer night at 62° never gets past twilight, so a "night" shot dealt
    // in summer is a blue picture with no stars in it.
    season: "autumn",
    weather: "clear",
    sun: { up: -14, rising: false },
    camera: "chase",
    t: 2.4,
  },
  storm: {
    why: "what the sea does when the wind means it: a black deck, rain in the air, a lit horizon",
    scene: "storm",
    seed: 7,
    craft: "marlin",
    season: "autumn",
    weather: "squall",
    sun: { up: 12, rising: false },
    camera: "far",
    t: 4,
  },
  dawn: {
    why: "the cold end of the day — a pale sea to the horizon under a high sky, the hull tiny in it",
    scene: "swell",
    seed: 12,
    craft: "skiff",
    season: "spring",
    weather: "high",
    sun: { up: 9, rising: true },
    camera: "heli",
    t: 2.6,
  },
};

/**
 * THE FRAMES A POSTER IS CUT TO — none of them the game's own reference
 * viewports (§35.2), because those two exist to catch a HUD that clips at
 * the sizes people play at, and this lab is photographing the water.
 *
 * `card` is the share image's exact 1200×630, so `--og` writes a frame that
 * was composed at the ratio it will be cropped to rather than one squeezed
 * into it afterwards.
 */
const VIEWPORTS = {
  poster: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  card: { viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 },
  tall: { viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 },
};

/**
 * THE SHARE CARD's own frame, and where the app mark is stamped on it. The
 * card gets reposted as a bare image with the page's title nowhere near it,
 * so it carries the mark; the FRAME carries everything else, which is the
 * whole point of photographing one instead of drawing it.
 *
 * The stamp is the site's OWN `icons/icon.svg`, laid over the page before
 * the shutter falls rather than composited into the PNG afterwards. That
 * way the card is stamped with the same mark the browser tab shows, at no
 * cost: nothing here has to decode a PNG, and nothing here restates the
 * palette the mark is drawn in.
 */
const OG = { viewport: "card", stamp: 132, margin: 36, radius: 30 };

/** The beat between laying the mark over the page and the shutter, ms. */
const STAMP_SETTLE = 200;

const args = parseArgs(
  process.argv.slice(2),
  {
    shot: {
      kind: "string",
      help: `which shot (${Object.keys(SHOTS).join(", ")}); all when left out`,
    },
    list: { kind: "flag", help: "print the table and what each row is for, and stop" },
    og: {
      kind: "string",
      help: "write this shot to pwa/public/og.png as well — the share card the site serves",
    },
    viewport: {
      kind: "string",
      default: "poster",
      help: `${Object.keys(VIEWPORTS).join(", ")} or all`,
    },
    hud: { kind: "flag", help: "leave the HUD on — for a store shot rather than a poster" },
    // A row's sun is the one number worth sweeping from the command line:
    // "how low is too low" is the question every one of these was tuned by,
    // and a session that has to edit the table to ask it will not ask it.
    // The override rides in the file name, so a sweep leaves one frame per
    // elevation instead of overwriting itself.
    sun: { kind: "number", help: "override the shot's sun elevation, degrees above the horizon" },
    rising: { kind: "string", help: "override whether that sun is rising: 1 or 0" },
    timeout: { kind: "number", default: 60, help: "seconds to wait for window.__SH_READY__" },
  },
  "usage: node scripts/hero-shots.mjs [--shot name | --og name] [--viewport poster|card|tall|all] " +
    "[--list] [--hud] [--sun deg] [--rising 0|1] [--timeout s]",
);

if (args.list) {
  for (const [name, shot] of Object.entries(SHOTS)) {
    const sun = shot.sun
      ? `sun ${shot.sun.up > 0 ? "+" : ""}${shot.sun.up}° ${shot.sun.rising ? "rising" : "falling"}`
      : "the level's own hour";
    console.log(
      `${name.padEnd(9)} ${shot.scene.padEnd(9)} seed ${String(shot.seed).padStart(3)}  ` +
        `${shot.craft.padEnd(7)} ${shot.season.padEnd(7)} ${shot.weather.padEnd(9)} ` +
        `${sun.padEnd(24)} ${shot.camera ?? "the scene's own"}\n          ${shot.why}`,
    );
  }
  process.exit(0);
}

const names = args.og ? [args.og] : args.shot ? String(args.shot).split(",") : Object.keys(SHOTS);
for (const name of names) {
  if (!SHOTS[name]) {
    console.error(`unknown shot "${name}" (${Object.keys(SHOTS).join(", ")})`);
    process.exit(2);
  }
}
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

// ── Where the sun stands ────────────────────────────────────────────────
// The engine's own solar model, and the level's own coast: a shot names an
// angle and this turns it into the hour that puts the sun there. Reading the
// biome table directly rather than through the engine's public surface is
// the same call level-map.mjs makes for `launchSpeedFor` — the latitude of a
// coast is not on that surface yet, and restating 62° here would be a number
// that is wrong the day a second coast lands.
const { DECLINATION, generateLevel, hourOfElevation } = await import(join(root, "engine/index.ts"));
const { biomeOf } = await import(join(root, "engine/mapgen/biomes.ts"));

const levels = new Map();

/** The hour that puts the sun `up` degrees over the horizon on the coast
 * `seed` deals, in `season` — or null when the sun never reaches it there,
 * which is a real answer this far north and not a failure. */
function hourFor(seed, season, sun) {
  if (!sun) return undefined;
  if (!levels.has(seed)) levels.set(seed, generateLevel(seed));
  const level = levels.get(seed);
  const hour = hourOfElevation(
    (sun.up * Math.PI) / 180,
    sun.rising,
    biomeOf(level.biome).latitude,
    DECLINATION[season],
  );
  if (hour === null) {
    console.error(
      `!! ${season} on the coast seed ${seed} deals never puts the sun at ${sun.up}° — ` +
        `the shot will ride at the hour the seed dealt it instead`,
    );
    return undefined;
  }
  return hour;
}

// ── The browser ─────────────────────────────────────────────────────────
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
console.log(`hero — ${names.join(", ")} at ${viewports.join("+")}, serving ${dist} at ${site.url}`);

let failures = 0;

/** The URL a shot is taken at. Every input is on it, so a picture in a PR
 * can be reopened in a browser exactly as it was shot. */
function urlFor(shot, hour) {
  const params = {
    seed: String(shot.seed),
    craft: shot.craft,
    scene: shot.scene,
    season: shot.season,
    weather: shot.weather,
    shot: "1",
    // The picture at its best — this is the one lab where the frame budget
    // does not matter, because nothing here has to run at sixty hertz.
    water: "high",
    detail: "high",
    distance: "high",
    see: "1",
    // No HUD, and no first-visit probe moving a row under the shutter.
    hud: args.hud ? "1" : "0",
    probe: "0",
  };
  // A row that names no camera rides the rung the scene was framed for.
  if (shot.camera !== undefined) params.camera = shot.camera;
  if (hour !== undefined) params.hour = hour.toFixed(3);
  if (shot.t !== undefined) params.t = String(shot.t);
  if (shot.hs !== undefined) params.hs = String(shot.hs);
  if (shot.wind !== undefined) params.wind = String(shot.wind);
  return `${site.url}?${new URLSearchParams(params)}`;
}

/**
 * One capture. Returns the PNG buffer as well as writing it, so the share
 * card is the frame that was just looked at rather than a second shot of the
 * same URL.
 */
async function capture(name, shot, hour, viewportName, { stamp = false } = {}) {
  const page = await browser.newPage({ ...VIEWPORTS[viewportName] });
  const problems = [];
  page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning")
      problems.push(`${msg.type()}: ${msg.text()}`);
  });
  const url = urlFor(shot, hour);
  const file = join(outDir, `hero-${name}${stamp ? "-stamped" : ""}-${viewportName}.png`);
  let png = null;
  try {
    await page.goto(url, { waitUntil: "load" });
    await page.waitForFunction("window.__SH_READY__ === true", null, {
      timeout: args.timeout * 1000,
    });
    if (stamp) await stampMark(page);
    png = await page.screenshot({ path: file });
    const at = hour === undefined ? "the seed's own hour" : `${hour.toFixed(2)}h`;
    console.log(`${file.slice(root.length + 1)}  (${at})  ← ${url}`);
  } catch (err) {
    failures += 1;
    const ready = await page.evaluate("window.__SH_READY__").catch(() => undefined);
    console.error(
      `!! ${name} (${viewportName}): ${err.message.split("\n")[0]}` +
        ` — window.__SH_READY__ is ${String(ready)} after ${args.timeout} s (${url})`,
    );
  }
  for (const p of problems) console.log(`   ${p}`);
  await page.close();
  return png;
}

/**
 * Lay the app mark over the page, bottom left, as its own tile.
 *
 * On its own tile rather than straight onto the frame: the wave's mass is
 * nearly black and its sun nearly white, and over a photograph of water both
 * of them vanish into it. On a tile it reads as what it is — the app's icon,
 * on a picture of the app.
 *
 * It is the BUILT SITE's own `icons/icon.svg`, read off disk and inlined
 * into a stylesheet rather than pointed at by URL. Two reasons: the mark on
 * the card is then provably the mark the browser tab shows, and a style tag
 * with its image already in it applies in one go — there is no load for the
 * shutter to race.
 */
async function stampMark(page) {
  const svg = readFileSync(join(dist, "icons", "icon.svg")).toString("base64");
  await page.addStyleTag({
    content: `body::after {
      content: "";
      position: fixed;
      left: ${OG.margin}px;
      bottom: ${OG.margin}px;
      width: ${OG.stamp}px;
      height: ${OG.stamp}px;
      border-radius: ${OG.radius}px;
      background: url("data:image/svg+xml;base64,${svg}") center / cover no-repeat;
      /* Most of these frames are deep teal water, which is what the tile
         itself is made of — without an edge it reads as a hole in the
         picture rather than as something laid on it. */
      box-shadow:
        0 2px 18px rgba(0, 0, 0, 0.45),
        0 0 0 2px rgba(242, 247, 248, 0.22);
      z-index: 9999;
    }`,
  });
  // One frame for the style to land in. The capture itself is several
  // frames on this rasterizer, but a screenshot does not wait on a
  // stylesheet and a card with no stamp on it is a silent miss.
  await page.waitForTimeout(STAMP_SETTLE);
}

/** A row as the flags leave it, and the tag its files are named with. An
 * overridden sun rides in the name, so a sweep leaves one frame per
 * elevation instead of overwriting itself. */
function staged(name) {
  const shot = SHOTS[name];
  if (args.sun === undefined && args.rising === undefined) return { shot, tag: name };
  const up = args.sun ?? shot.sun?.up ?? 0;
  const rising = args.rising === undefined ? (shot.sun?.rising ?? false) : args.rising === "1";
  return {
    shot: { ...shot, sun: { up, rising } },
    tag: `${name}-sun${up}${rising ? "up" : "down"}`,
  };
}

for (const name of names) {
  const { shot, tag } = staged(name);
  const hour = hourFor(shot.seed, shot.season, shot.sun);
  for (const v of viewports) await capture(tag, shot, hour, v);
}

// ── The share card ──────────────────────────────────────────────────────
// Its own capture, at the card's ratio and with the mark stamped on it, so
// the same shot taken for the previews folder stays a clean frame.
if (args.og) {
  const { shot, tag } = staged(args.og);
  const hour = hourFor(shot.seed, shot.season, shot.sun);
  const png = await capture(tag, shot, hour, OG.viewport, { stamp: true });
  if (png) {
    writeFileSync(join(root, "pwa", "public", "og.png"), png);
    console.log(`pwa/public/og.png  ← hero ${args.og}, stamped`);
  } else {
    console.error(`!! no frame captured for --og ${args.og}; og.png left alone`);
  }
}

await browser.close();
await site.close();
if (failures > 0) {
  console.error(`${failures} shot${failures === 1 ? "" : "s"} failed`);
  process.exit(1);
}
