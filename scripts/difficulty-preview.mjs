#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DIFFICULTY SCHEMATIC: one level from above with what makes it HARD
// drawn over the plan, so a campaign rung can be judged by eye as well as
// by `make rate`'s row. Pure Node — the engine and the level painter,
// no build, no browser, seconds.
//
//   make difficulty SEED=38                       previews/difficulty-38.png
//   make difficulty SEED=7 BIOME=mangrove ARGS=--tricks
//   make difficulty SEED=38 ARGS="--hour 21 --weather squall --wind 13"
//   make difficulty CAMPAIGN=1                    one sheet per committed level
//
// Over `level-draw.mjs`'s map it lays, in this order:
//
//   THE LINE BY ITS CORNERS — the path re-stroked in a ladder from green
//   (straight) through amber to red (a bend at R23's floor), so the tight
//   half of a shore stands out from the sweeping half before a number has
//   been read; every corner tighter than one and a half floors gets its
//   radius written beside it.
//   THE SEA ALONG THE LINE — at every hundred metres a bar across the
//   path scaled by the significant height met there (`seaSummary` of the
//   very sea the run would build), so a course that runs out of a bay into
//   the swell reads as bars growing; the biggest is labelled.
//   WHERE THE WATER COMES FROM — two arrows off the compass rose: the
//   wind (and the sea it grows) and the groundswell rolling in off the
//   open water, each with its figure, so a beam sea and a head sea are
//   told apart at a glance.
//   THE ROCKS WITHIN REACH — every solid inside forty metres of the line
//   ringed in red, which is the count the rating's rocks axis is made of.
//   THE PANEL — the eight axes as bars with their raw readings, the
//   difficulty index, the conditions the level is rated under, the axis
//   it leads on and its digest.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "./lib/cli.mjs";
import { aliasEngine } from "./lib/engine-alias.mjs";
import { MARGIN, TITLE_H, arrow, label, renderLevelMap } from "./lib/level-draw.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
aliasEngine(root);
const {
  BIOME_IDS,
  RATING_AXES,
  SEASONS,
  WEATHER_IDS,
  createSea,
  generateLevel,
  isBiomeId,
  leadingAxis,
  levelDigest,
  rateLevel,
  cornerRadius,
  rulesAtPace,
  seaSummary,
} = await import(join(root, "engine/index.ts"));

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 38, help: "the seed to draw" },
    biome: { kind: "string", default: "taiga", help: "which coast (taiga, mangrove, arctic)" },
    track: { kind: "string", default: "coast", help: "coast (a shore sprint) or circuit (a lap)" },
    tricks: { kind: "flag", help: "build it as a TRICKS run (R35's line of ramps)" },
    swell: { kind: "number", help: "build it under this groundswell, m (R36)" },
    hour: { kind: "number", help: "rate under this start hour instead of the level's own" },
    season: { kind: "string", help: "…this season" },
    weather: { kind: "string", help: "…this sky" },
    wind: { kind: "number", help: "…this wind, m/s" },
    scale: { kind: "number", default: 0.6, help: "pixels per metre" },
    campaign: { kind: "flag", help: "draw every committed campaign level instead" },
    out: { kind: "string", help: "file name under previews/ (one level only)" },
  },
  "usage: npm run difficulty -- [--seed n] [--biome taiga|mangrove|arctic] [--track coast|circuit] [--tricks] [--swell m] [--hour h] [--season s] [--weather w] [--wind m/s] [--scale px/m] [--campaign] [--out name]",
);

if (!isBiomeId(args.biome)) {
  console.error(`unknown biome "${args.biome}" (${BIOME_IDS.join(", ")})`);
  process.exit(2);
}
if (args.season !== undefined && !SEASONS.includes(args.season)) {
  console.error(`unknown season "${args.season}" (${SEASONS.join(", ")})`);
  process.exit(2);
}
if (args.weather !== undefined && !WEATHER_IDS.includes(args.weather)) {
  console.error(`unknown weather "${args.weather}" (${WEATHER_IDS.join(", ")})`);
  process.exit(2);
}

const INK = [24, 24, 28];
const RED = [200, 40, 40];
const SEA_INK = [20, 70, 160];
const SWELL_INK = [120, 40, 160];
const PANEL_W = 300;
/** The rating's own reach for a rock in the way (`engine/rating/`). */
const ROCK_REACH = 40;
const deg = (rad) => ((rad * 180) / Math.PI + 360) % 360;

/** The corner ladder: green for a straight, amber halfway, red at R23's
 * floor. `t` is 0 straight … 1 at the floor. */
function cornerInk(t) {
  const k = Math.max(0, Math.min(1, t));
  if (k < 0.5) return [60 + (230 - 60) * (k * 2), 160, 60];
  return [230, 160 - (160 - 40) * ((k - 0.5) * 2), 40];
}

/** Draw one level's sheet and write it. */
function drawSheet({ level, conditions, name, title }) {
  const rating = rateLevel(level, conditions);
  const R = rulesAtPace(level.pace, level.rampWidth);
  const b = level.bounds;
  const scale = args.scale;
  const canvas = renderLevelMap({ level, scale, title, lines: [] });
  const px = (x) => MARGIN + (x - b.minX) * scale;
  const py = (z) => TITLE_H + (b.maxZ - z) * scale;
  const path = level.course.path;

  // ── The line by its corners ────────────────────────────────────────────
  const floor = R.course.radius;
  for (let i = 1; i + 1 < path.length; i++) {
    const r = cornerRadius(path, i);
    // A radius at the floor is 1, four floors out is 0.
    const t = r === Infinity ? 0 : 1 - Math.min(1, Math.max(0, (r - floor) / (3 * floor)));
    canvas.line(
      px(path[i - 1].x),
      py(path[i - 1].z),
      px(path[i].x),
      py(path[i].z),
      cornerInk(t),
      3,
    );
  }
  // The tight corners, each labelled once: walk the path and label the
  // tightest point of each run that stays under twice the floor.
  let inCorner = false;
  let best = { r: Infinity, i: -1 };
  const closeCorner = () => {
    if (best.i >= 0) {
      label(
        canvas,
        px(path[best.i].x) + 6,
        py(path[best.i].z) - 10,
        `R${Math.round(best.r)}`,
        RED,
        1,
      );
    }
    inCorner = false;
    best = { r: Infinity, i: -1 };
  };
  for (let i = 1; i + 1 < path.length; i++) {
    const r = cornerRadius(path, i);
    if (r < 1.5 * floor) {
      inCorner = true;
      if (r < best.r) best = { r, i };
    } else if (inCorner) closeCorner();
  }
  if (inCorner) closeCorner();

  // ── The sea along the line ─────────────────────────────────────────────
  const sea = createSea(level, level.seed, {
    from: level.wind.from,
    speed: rating.conditions.wind,
  });
  let since = 100;
  let biggest = { hs: 0, x: 0, z: 0 };
  for (let i = 1; i < path.length; i++) {
    since += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
    if (since < 100) continue;
    since = 0;
    const { Hs } = seaSummary(sea, path[i].x, path[i].z);
    // A bar ACROSS the line, 20 px a metre of Hs, centred on the path.
    const hx = path[i].x - path[i - 1].x;
    const hz = path[i].z - path[i - 1].z;
    const len = Math.hypot(hx, hz) || 1;
    const nx = -hz / len;
    const nz = hx / len;
    const half = (Hs * 10) / scale;
    canvas.line(
      px(path[i].x - nx * half),
      py(path[i].z - nz * half),
      px(path[i].x + nx * half),
      py(path[i].z + nz * half),
      SEA_INK,
      2,
    );
    if (Hs > biggest.hs) biggest = { hs: Hs, x: path[i].x, z: path[i].z };
  }
  if (biggest.hs > 0) {
    label(
      canvas,
      px(biggest.x) + 8,
      py(biggest.z) + 4,
      `HS ${biggest.hs.toFixed(1)} M`,
      SEA_INK,
      1,
    );
  }

  // ── Where the water comes from: a rose at the top left of the plan ─────
  const rose = { x: MARGIN + 70, y: TITLE_H + 70 };
  canvas.circle(rose.x, rose.y, 44, [200, 200, 200], 1);
  const windTravel = level.wind.from + Math.PI;
  const swellTravel = level.seaHeading + Math.PI;
  const windLen = 12 + 2.4 * rating.conditions.wind;
  arrow(
    canvas,
    rose.x - Math.sin(windTravel) * windLen,
    rose.y + Math.cos(windTravel) * windLen,
    Math.sin(windTravel) * windLen * 2,
    -Math.cos(windTravel) * windLen * 2,
    SEA_INK,
    2,
  );
  const swellLen = 10 + 1.6 * level.swell;
  arrow(
    canvas,
    rose.x - Math.sin(swellTravel) * swellLen,
    rose.y + Math.cos(swellTravel) * swellLen,
    Math.sin(swellTravel) * swellLen * 2,
    -Math.cos(swellTravel) * swellLen * 2,
    SWELL_INK,
    2,
  );
  label(
    canvas,
    rose.x - 60,
    rose.y + 52,
    `WIND ${rating.conditions.wind.toFixed(0)} M/S FROM ${deg(level.wind.from).toFixed(0)}°`,
    SEA_INK,
    1,
  );
  label(
    canvas,
    rose.x - 60,
    rose.y + 62,
    `SWELL ${level.swell.toFixed(1)} M FROM ${deg(level.seaHeading).toFixed(0)}°`,
    SWELL_INK,
    1,
  );

  // ── The rocks within reach ─────────────────────────────────────────────
  for (const s of level.solids) {
    if (s.kind === "buoy" || s.kind === "mark") continue;
    const reach = ROCK_REACH + s.r;
    let closest = Infinity;
    for (let i = 0; i + 1 < path.length; i += 2) {
      closest = Math.min(closest, Math.hypot(s.x - path[i].x, s.z - path[i].z));
    }
    if (closest <= reach) canvas.circle(px(s.x), py(s.z), Math.max(4, s.r * scale + 3), RED, 2);
  }

  // ── The panel, over the map's own key column ───────────────────────────
  const panelX = canvas.width - PANEL_W + 8;
  let y = TITLE_H + 8;
  canvas.fillRect(
    canvas.width - PANEL_W,
    TITLE_H,
    PANEL_W,
    canvas.height - TITLE_H,
    [246, 244, 238],
  );
  label(canvas, panelX, y, `DIFFICULTY ${rating.difficulty.toFixed(3)}`, INK, 2);
  y += 24;
  label(canvas, panelX, y, `LEADS ON ${leadingAxis(rating.axes).toUpperCase()}`, INK, 1);
  y += 18;
  const readings = {
    sea: `HS ${rating.stats.hs.toFixed(2)} M, MAX ${rating.stats.hsMax.toFixed(1)}`,
    corners: `${(rating.stats.tight * 100).toFixed(0)}% TIGHT, ${rating.stats.sweepPerKm.toFixed(1)} RAD/KM`,
    air: `${rating.stats.rampsPerKm.toFixed(1)} RAMPS/KM`,
    rocks: `${rating.stats.rocksPerKm.toFixed(1)} ROCKS/KM IN REACH`,
    length: `${(rating.stats.ridden / 1000).toFixed(2)} KM RIDDEN, ${level.course.laps} LAP${level.course.laps > 1 ? "S" : ""}`,
    wind: `${rating.conditions.wind.toFixed(1)} M/S`,
    dark: `SUN ${rating.stats.sunDeg.toFixed(0)}° AT ${rating.conditions.hour.toFixed(1)}H ${rating.conditions.season.toUpperCase()}`,
    sky: rating.conditions.weather.toUpperCase(),
  };
  for (const axis of RATING_AXES) {
    const v = rating.axes[axis];
    label(canvas, panelX, y, axis.toUpperCase(), INK, 1);
    canvas.rect(panelX + 64, y - 1, 120, 9, [180, 180, 180]);
    canvas.fillRect(panelX + 65, y, Math.round(118 * v), 7, cornerInk(v));
    label(canvas, panelX + 190, y, v.toFixed(2), INK, 1);
    y += 12;
    label(canvas, panelX + 8, y, readings[axis], [90, 90, 96], 1);
    y += 16;
  }
  y += 6;
  label(
    canvas,
    panelX,
    y,
    `${level.course.gates.length} GATES, ${level.course.gates.filter((g) => g.ramp).length + level.ramps.length} RAMPS`,
    INK,
    1,
  );
  y += 12;
  label(canvas, panelX, y, `DIGEST ${levelDigest(level)}`, INK, 1);
  y += 12;
  label(canvas, panelX, y, `${args.scale} PX/M`, [90, 90, 96], 1);
  y += 20;
  label(canvas, panelX, y, "LINE: GREEN STRAIGHT, RED AT R23", [90, 90, 96], 1);
  y += 10;
  label(canvas, panelX, y, "BARS: HS ACROSS THE LINE, 100 M", SEA_INK, 1);
  y += 10;
  label(canvas, panelX, y, "RED RINGS: ROCKS IN REACH", RED, 1);

  const outDir = join(root, "previews");
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, `${name}.png`);
  writeFileSync(file, canvas.toPng());
  console.log(
    `wrote ${file} (${canvas.width}×${canvas.height}) — difficulty ${rating.difficulty.toFixed(3)}, leads on ${leadingAxis(rating.axes)}`,
  );
}

if (args.campaign) {
  const { SHORES } = await import(join(root, "pwa/src/game/campaign-levels.ts"));
  const { buildCampaignLevel, campaignConditions } = await import(
    join(root, "pwa/src/game/campaign.ts")
  );
  for (const shore of SHORES) {
    for (const pinned of shore.levels) {
      const level = buildCampaignLevel(pinned);
      drawSheet({
        level,
        conditions: campaignConditions(pinned),
        name: `difficulty-${pinned.id}`,
        title: `${pinned.id.toUpperCase()}  ${pinned.name.toUpperCase()}  SEED ${pinned.seed}  ${pinned.mode.toUpperCase()}  V${pinned.version}`,
      });
    }
  }
} else {
  const level = generateLevel(args.seed, {
    biome: args.biome,
    track: args.track,
    tricks: args.tricks,
    swell: args.swell,
  });
  const conditions = {};
  if (args.hour !== undefined) conditions.hour = args.hour;
  if (args.season !== undefined) conditions.season = args.season;
  if (args.weather !== undefined) conditions.weather = args.weather;
  if (args.wind !== undefined) conditions.wind = args.wind;
  drawSheet({
    level,
    conditions,
    name:
      args.out ??
      `difficulty-${args.biome === "taiga" ? "" : `${args.biome}-`}${args.seed}${args.tricks ? "-tricks" : ""}`,
    title: `SEED ${args.seed}  ${level.biome.toUpperCase()}  ${args.track.toUpperCase()}${args.tricks ? "  TRICKS" : ""}`,
  });
}
