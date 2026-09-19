#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE COAST, PHOTOGRAPHED — one banner per shore for the campaign and level
// cards' shore rows, taken by the REAL GAME rather than drawn as a diagram.
//
// A shore is a COAST, not a course: the taiga is nine levels and the
// mangrove is nine more, so a banner that was a layout of any one of them
// would be advertising water the row is not about — and the row already has
// a layout under it on every box (`make routes`). What a row wants is
// the PLACE: the colour of the water, how far into it the eye gets, what
// grows on the shore, what the light is like. The only honest source for any
// of that is the renderer that draws it in a run.
//
// So the camera is stood at a staged moment on the shore's FIRST pinned
// level, at the HELICOPTER rung of the game's own ladder — 9 m up, 16 m
// back, horizon in the top third (`camera-rigs.ts`). The first level rather
// than a chosen one because it is the water that shore introduces itself
// with, the first thing a player will actually ride of it; the helicopter
// rung because it is the one rung that has the coast, the sea and the sky in
// frame at once, and the craft is in it on purpose — the row is selling a
// game, and a picture of empty water sells a screensaver.
//
// Everything about the frame comes off switches the game already has, so the
// picture is the game's own and not a special renderer's:
//
//   ?mode=free  the one mode allowed a seed, a day and a sea of its own, so
//               the shore's own hour, season, sky, wind and swell can all be
//               quoted at it (`new-game.ts`'s `freeRides`). The first level
//               of every shore is a coast RACE, so nothing about a tricks
//               field or a lapped circuit has to be asked for here
//   ?scene=     stand the run in a staged moment and freeze it
//   ?camera=    which rung of the ladder it is seen from
//   ?shot=1     FREEZE there and set `window.__SH_READY__` once the frame is
//               drawn — the same flag `make screenshots` waits on
//   ?probe=0    do not measure the machine on the way in: a picture row
//               moving under the camera is a banner shot at a resolution
//               nobody chose
//   ?water=…    ...and then every picture row pinned to its TOP stop. This
//               is the one frame in the game that can afford them: a banner
//               is drawn once, by a tool, and is the first thing a player
//               ever sees of a coast. DISTANCE is the row that earns it
//               twice over — a 100° frame looks past where the run's own
//               draw radius stops, and the drawn edge of the sea against
//               the sky is a pale seam in the top corners that reads as a
//               rendering bug and is not one
//
// THE ONE THING TO KNOW BEFORE MOVING THE CAMERA: this rung follows the
// CRAFT. There is no free camera in this game, so what the flags below buy
// is a different moment and a different seat, never a different place —
// `--scene offshore` is the way to get further out, not a lift.
//
//   make coasts
//   make coasts SCENE=offshore CAMERA=drone       # try another shot
//   make coasts OUT=previews                      # somewhere to compare, not ship
//
// Needs a Chromium (CHROMIUM_PATH overrides the default) and a built
// pwa/dist, because that is what it serves. Run `make build` first, or the
// banners are a photograph of the previous change.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "./lib/cli.mjs";
import { aliasEngine } from "./lib/engine-alias.mjs";
import { serveDir } from "./lib/serve-dist.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "pwa", "dist");
aliasEngine(root);
const { SHORES } = await import(join(root, "pwa/src/game/campaign-levels.ts"));

const args = parseArgs(
  process.argv.slice(2),
  {
    scene: { kind: "string", default: "cruise", help: "the staged moment (scenarios.ts)" },
    camera: { kind: "string", default: "heli", help: "which rung of the camera ladder" },
    width: { kind: "number", default: 1280, help: "the banner's width, px" },
    aspect: { kind: "number", default: 2.4, help: "...and how many times wider than tall" },
    quality: { kind: "number", default: 80, help: "JPEG quality" },
    settle: { kind: "number", default: 1500, help: "ms after the frame is ready" },
    timeout: { kind: "number", default: 120, help: "seconds to wait for a frame" },
    out: { kind: "string", default: "pwa/public/previews", help: "where the banners land" },
  },
  "usage: node scripts/coast-preview.mjs [--scene name] [--camera rung] [--out dir]",
);

/** The banner, px. A PANORAMA rather than a 16:9 frame, because the shape it
 * has to fill is a menu row — a shore row is between three and four times as
 * wide as it is tall on every viewport either card is read at, and a 16:9
 * picture cropped to that throws half its height away before it is seen.
 *
 * NARROWER THAN THE ROW ON PURPOSE, which is the opposite of the sibling
 * rally game's answer and follows from the same arithmetic run the other
 * way. `object-fit: cover` fills the box from whichever axis runs out first:
 * a source narrower than its box fills by WIDTH and chooses a BAND of its
 * own height, and a source wider than its box fills by height and throws
 * away its sides. This shot wants the first — every degree across is coast
 * and the row picks its band with `object-position` (`.menu-shore-shot`) —
 * because the row's slow pan is bought by the BOX being wider than the row,
 * not by the picture being wider than the box, so there is nothing for the
 * surplus width to do but bend the sea.
 *
 * And bend it, it would: three.js's fov is VERTICAL, so a wider frame on a
 * fixed lens opens the HORIZONTAL field instead of showing more of the same
 * lens. The helicopter rung's 52° vertical is 88° across at 2:1, 100° at
 * 2.4 and 111° at 3 — and past about 100° the far corners are looking out
 * beyond where even the top DISTANCE stop draws, which puts the drawn edge
 * of the sea in shot as a pale seam above the horizon. 2.4 is the widest
 * frame that keeps that seam in the top corners, where the row's own band
 * crops it off. */
const W = Math.round(args.width);
const H = Math.round(W / args.aspect);

/** JPEG, and not PNG. A render of a coast is a photograph as far as a
 * compressor is concerned — a sky gradient, a glittering sea, thousands of
 * shaded leaves — and PNG spends a quarter of a megabyte on one.
 *
 * 1280 across is the width that goes with it: the row's picture box is 130%
 * of a card that is 40rem at its widest, so the banner is drawn about 860
 * device pixels across on a phone at 2x and 550 on a desktop. Twice the
 * widest of those is the last width that buys anything, and the two together
 * keep a coast with a forest down both sides inside 120 KB — which is what
 * a card is worth, since both banners are fetched before either is pressed. */
const QUALITY = args.quality;

/** The chrome that is drawn for a human at the controls and is not part of
 * the coast. `.hud` is the whole of it: the readouts, the touch controls and
 * the new-build notice all hang inside that one element (`App.tsx`), and the
 * game has no switch of its own that takes it off mid-run. */
const HIDE = ".hud { display: none !important; }";

const outDir = join(root, args.out);

if (!existsSync(join(dist, "index.html"))) {
  console.error("no pwa/dist — run `make build` first (this serves the built site)");
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });

/** The receipt module, written the way prettier would have written it so a
 * regeneration on a clean tree is a no-op. */
function shotsModule(rows) {
  const entries = rows
    .map(
      (s) =>
        `  ${s.coast}: {\n    level: "${s.level}",\n    seed: ${s.seed},\n` +
        `    scene: "${s.scene}",\n    camera: "${s.camera}",\n` +
        `    hour: ${s.hour},\n    season: "${s.season}",\n    weather: "${s.weather}",\n` +
        `    wind: ${s.wind},\n    swell: ${s.swell},\n  },`,
    )
    .join("\n");
  return `// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// GENERATED by \`make coasts\` (scripts/coast-preview.mjs). Do not edit.
//
// WHAT EACH COAST BANNER IS A PICTURE OF. The banners themselves are JPEGs
// under pwa/public/previews/, rendered by the real game at a staged moment
// on the shore's FIRST pinned level — so what they show depends entirely on
// that level's seed, its coast and the day it pins.
//
// Nothing at runtime reads this. It exists because a photograph cannot be
// recomputed and compared the way a course line can: without it, re-seeding
// a shore's first level leaves a banner of water nobody rides, under a sky
// the level is no longer set in, and NOTHING anywhere would say so.
// tests/shore_preview_test.ts holds this against campaign-levels.ts.

export type CoastShot = {
  /** The pinned level the moment was staged on. */
  level: string;
  seed: number;
  /** The staged moment and the rung of the camera ladder it was seen from. */
  scene: string;
  camera: string;
  hour: number;
  season: string;
  weather: string;
  /** The mean wind, m/s, and the groundswell standing off the coast, m. */
  wind: number;
  swell: number;
};

export const COAST_SHOTS: Record<string, CoastShot> = {
${entries}
};
`;
}

const site = await serveDir(dist);
const { chromium } = await import("playwright-core");
const executablePath = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
if (!existsSync(executablePath)) {
  console.error(`no Chromium at ${executablePath} — set CHROMIUM_PATH`);
  process.exit(2);
}
const browser = await chromium.launch({ executablePath });

console.log(
  `coasts — ${SHORES.length} shores, ${args.scene} at the ${args.camera} rung, ` +
    `${W}x${H} (${args.aspect}:1), serving ${dist} at ${site.url}`,
);

const taken = [];
let failures = 0;

for (const shore of SHORES) {
  // The shore's opening water — the level its ladder starts on.
  const level = shore.levels[0];
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on("pageerror", (err) => console.error(`  [pageerror] ${err.message}`));
  // FREE is the one mode that takes a seed AND a whole day, which is what
  // lets the shot stand on the pinned shore under the sky it is pinned in.
  const params = new URLSearchParams({
    mode: "free",
    seed: String(level.seed),
    biome: shore.id,
    track: level.track,
    hour: String(level.hour),
    season: level.season,
    weather: level.weather,
    day: String(level.wind),
    waves: String(level.swell),
    scene: args.scene,
    camera: args.camera,
    shot: "1",
    probe: "0",
    // The shop window, drawn at the top of every ladder — see the header.
    water: "high",
    res: "high",
    detail: "high",
    distance: "high",
    see: "1",
  });
  const url = `${site.url}?${params}`;
  const file = join(outDir, `coast-${shore.id}.jpg`);
  try {
    await page.goto(url, { waitUntil: "load" });
    await page.waitForFunction("window.__SH_READY__ === true", null, {
      timeout: args.timeout * 1000,
    });
    await page.addStyleTag({ content: HIDE });
    await page.waitForTimeout(args.settle);
    const jpeg = await page.screenshot({ type: "jpeg", quality: QUALITY });
    writeFileSync(file, jpeg);
    taken.push({
      coast: shore.id,
      level: level.id,
      seed: level.seed,
      scene: args.scene,
      camera: args.camera,
      hour: level.hour,
      season: level.season,
      weather: level.weather,
      wind: level.wind,
      swell: level.swell,
    });
    console.log(
      `${file} — ${(jpeg.length / 1024).toFixed(1)} KB\n` +
        `  ${shore.name} over ${level.id} (seed ${level.seed}), ` +
        `${level.hour}h ${level.weather} ${level.season}, ` +
        `${level.wind} m/s, ${level.swell} m swell\n  ${url}`,
    );
  } catch (err) {
    failures += 1;
    console.error(`!! ${shore.id}: ${err.message.split("\n")[0]}\n   ${url}`);
  }
  await page.close();
}

// The receipt. A banner is a JPEG, so nothing can recompute it and check —
// the only way a stale one is ever noticed is if the tree says what it is a
// picture OF. `tests/shore_preview_test.ts` holds this against
// campaign-levels.ts, so a shore whose first level is re-seeded or moved to
// another hour fails the suite instead of quietly keeping last month's sky
// on the card. Only written for a full sweep into the shipping directory: a
// partial run, or one aimed at a scratch directory to compare shots in, is
// not what ships.
if (outDir === join(root, "pwa/public/previews") && failures === 0) {
  writeFileSync(join(root, "pwa/src/game/coast-shots.ts"), shotsModule(taken));
  console.log(`\npwa/src/game/coast-shots.ts — ${taken.length} shots`);
}

await browser.close();
await site.close();
if (failures > 0) {
  console.error(`\n${failures} banner(s) failed`);
  process.exit(1);
}
