#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// RATE generated levels — how HARD each one is, and what KIND of hard —
// which is the question a CAMPAIGN is built out of. `make analyze` says
// whether a level is broken; this says, of the ones that are not, which
// asks more of the rider, on eight axes (the sea, the corners, the air,
// the rocks, the length, the wind, the dark, the sky — `engine/rating/`)
// folded into one difficulty index. Pure Node: the engine and nothing
// else, seconds a seed.
//
//   make rate                            the four usual seeds
//   make rate COUNT=48 BIOME=mangrove    a sweep to shortlist from
//   make rate SEEDS=7,38 ARGS=--tricks   the same seeds built as tricks runs
//   make rate ARGS="--hour 21 --weather squall --wind 13"   under pinned conditions
//   make rate COUNT=96 ARGS=--stats      the POPULATION per axis: where the
//                                        scales in `RATING` sit against it
//   make rate CAMPAIGN=1                 the committed ladder, audited as a
//                                        set: does every rung ask more than
//                                        the one before, is any pair the
//                                        same shore twice
//
// The table prints a row per seed: the analyzer's error count (a level the
// generator would not hand out is not a candidate whatever it rates), the
// sea met along the line, the corners, the ramps, the rocks, the distance,
// the eight axes and the index — and the axis the shore LEADS on, which is
// what tells six candidates apart before the index has.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "./lib/cli.mjs";
import { aliasEngine } from "./lib/engine-alias.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
aliasEngine(root);
const {
  BIOME_IDS,
  RATING,
  RATING_AXES,
  WEATHER_IDS,
  SEASONS,
  analyzeLevel,
  engineVersion,
  generateLevel,
  isBiomeId,
  leadingAxis,
  levelDigest,
  rateLadder,
  rateLevel,
} = await import(join(root, "engine/index.ts"));

const DEFAULT_SEEDS = [1, 7, 38, 123];

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", help: "one seed" },
    seeds: { kind: "list", help: "several seeds, comma-separated" },
    count: { kind: "number", help: "seeds 1..N — the sweep" },
    biome: {
      kind: "string",
      default: "taiga",
      help: "which coast (taiga, mangrove, arctic, karst)",
    },
    track: { kind: "string", default: "coast", help: "coast (a shore sprint) or circuit (a lap)" },
    tricks: { kind: "flag", help: "build each seed as a TRICKS run (R35's line of ramps)" },
    hour: { kind: "number", help: "rate under this start hour instead of the level's own" },
    season: { kind: "string", help: `…this season (${"spring,summer,autumn,winter"})` },
    weather: { kind: "string", help: "…this sky" },
    wind: { kind: "number", help: "…this wind, m/s" },
    swell: { kind: "number", help: "build each seed under this groundswell, m (R36)" },
    stats: { kind: "flag", help: "print the population per axis instead of the rows" },
    campaign: { kind: "flag", help: "audit the committed campaign ladder (campaign-levels.ts)" },
    json: { kind: "string", help: "write every rating to this file" },
  },
  "usage: npm run rate -- [--seed n | --seeds a,b,c | --count n] [--biome taiga|mangrove|arctic|karst] [--track coast|circuit] [--tricks] [--hour h] [--season s] [--weather w] [--wind m/s] [--swell m] [--stats] [--campaign] [--json path]",
);

const pad = (v, n) => String(v).padStart(n);
const padEnd = (v, n) => String(v).padEnd(n);
const f = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : "—");

/** One row of the table, from a built level under its conditions. */
function rowOf(label, level, conditions) {
  const analysis = analyzeLevel(level);
  const rating = rateLevel(level, conditions);
  const errors = analysis.findings.filter((x) => x.severity === "error").length;
  return { label, level, analysis, rating, errors };
}

function printHeader() {
  console.log(
    [
      padEnd("level", 12),
      pad("err", 4),
      pad("km", 5),
      pad("laps", 4),
      pad("Hs", 5),
      pad("max", 5),
      pad("tight", 6),
      pad("rad/km", 7),
      pad("rmp/km", 7),
      pad("rck/km", 7),
      pad("wind", 5),
      pad("sun°", 5),
      pad("sky", 9),
      ...RATING_AXES.map((a) => pad(a.slice(0, 4), 5)),
      pad("index", 6),
      "  leads",
      "  digest",
    ].join(" "),
  );
}

function printRow(row) {
  const { rating: r, level, errors } = row;
  console.log(
    [
      padEnd(row.label, 12),
      pad(errors, 4),
      pad(f(level.course.length / 1000, 2), 5),
      pad(level.course.laps, 4),
      pad(f(r.stats.hs, 2), 5),
      pad(f(r.stats.hsMax, 1), 5),
      pad(f(r.stats.tight, 2), 6),
      pad(f(r.stats.sweepPerKm, 1), 7),
      pad(f(r.stats.rampsPerKm, 1), 7),
      pad(f(r.stats.rocksPerKm, 1), 7),
      pad(f(r.conditions.wind, 1), 5),
      pad(f(r.stats.sunDeg, 0), 5),
      pad(r.conditions.weather, 9),
      ...RATING_AXES.map((a) => pad(f(r.axes[a], 2), 5)),
      pad(f(r.difficulty, 3), 6),
      "  " + padEnd(leadingAxis(r.axes), 7),
      levelDigest(level),
    ].join(" "),
  );
}

function printStats(rows) {
  console.log(`\npopulation — ${rows.length} levels`);
  console.log(
    [
      padEnd("axis", 8),
      pad("min", 6),
      pad("q1", 6),
      pad("median", 7),
      pad("q3", 6),
      pad("max", 6),
      pad("at 1", 6),
      pad("at 0", 6),
    ].join(" "),
  );
  const q = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  for (const axis of [...RATING_AXES, "difficulty"]) {
    const values = rows
      .map((row) => (axis === "difficulty" ? row.rating.difficulty : row.rating.axes[axis]))
      .sort((a, b) => a - b);
    const saturated = values.filter((v) => v >= 0.999).length / values.length;
    const floored = values.filter((v) => v <= 0.001).length / values.length;
    console.log(
      [
        padEnd(axis, 8),
        pad(f(values[0]), 6),
        pad(f(q(values, 0.25)), 6),
        pad(f(q(values, 0.5)), 7),
        pad(f(q(values, 0.75)), 6),
        pad(f(values[values.length - 1]), 6),
        pad(`${Math.round(saturated * 100)}%`, 6),
        pad(`${Math.round(floored * 100)}%`, 6),
      ].join(" "),
    );
  }
  console.log(
    "\nan axis pinned at 1 for most of the sweep measures nothing — raise its scale in " +
      "engine/rating/index.ts; one at 0 for most of it is a wish, not a measurement",
  );
}

/** The committed ladder: every shore's six levels, built the way the
 * campaign builds them and rated under the conditions it pins. */
async function auditCampaign() {
  const { SHORES } = await import(join(root, "pwa/src/game/campaign-levels.ts"));
  const { buildCampaignLevel, campaignConditions } = await import(
    join(root, "pwa/src/game/campaign.ts")
  );
  const all = [];
  for (const shore of SHORES) {
    console.log(`\n${shore.name.toUpperCase()} — ${shore.levels.length} levels`);
    printHeader();
    const rungs = [];
    for (const pinned of shore.levels) {
      const level = buildCampaignLevel(pinned);
      const row = rowOf(pinned.id, level, campaignConditions(pinned));
      printRow(row);
      if (levelDigest(level) !== pinned.digest) {
        console.log(
          `  !! ${pinned.id} builds to ${levelDigest(level)} and pins ${pinned.digest} — the generator moved under it`,
        );
      }
      rungs.push({ name: pinned.id, rating: row.rating });
      all.push({ ...row, pinned });
    }
    const ladder = rateLadder(rungs);
    console.log(
      `  ladder: asks ${ladder.asks.map((a) => a.toFixed(3)).join(" → ")} · ` +
        `smallest step ${ladder.climb.toFixed(3)} · biggest ${ladder.wall.toFixed(3)} · ` +
        `closest pair ${ladder.apart.toFixed(2)}`,
    );
    for (const note of ladder.notes) console.log(`  !  ${note}`);
    if (ladder.notes.length === 0)
      console.log("  ok — every rung asks more, and none is another twice");
  }
  return all;
}

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

console.log(
  `rate — engine ${engineVersion} · scales: sea ${RATING.scale.sea} m, tight ${RATING.scale.tight}, ` +
    `sweep ${RATING.scale.sweepPerKm} rad/km, ramps ${RATING.scale.rampsPerKm}/km, rocks ${RATING.scale.rocksPerKm}/km, ` +
    `ridden ${RATING.scale.ridden} m, sun ${RATING.scale.sunHigh}°`,
);

let rows;
if (args.campaign) {
  rows = await auditCampaign();
} else {
  const seeds = args.seeds
    ? args.seeds.map(Number)
    : args.seed !== undefined
      ? [args.seed]
      : args.count !== undefined
        ? Array.from({ length: args.count }, (_, i) => i + 1)
        : DEFAULT_SEEDS;
  const conditions = {};
  if (args.hour !== undefined) conditions.hour = args.hour;
  if (args.season !== undefined) conditions.season = args.season;
  if (args.weather !== undefined) conditions.weather = args.weather;
  if (args.wind !== undefined) conditions.wind = args.wind;
  console.log(
    `${args.biome} ${args.track}${args.tricks ? " tricks" : ""} · seeds ${seeds.length > 12 ? `1..${seeds.length}` : seeds.join(",")}` +
      (Object.keys(conditions).length > 0 ? ` · under ${JSON.stringify(conditions)}` : ""),
  );
  rows = [];
  if (!args.stats) printHeader();
  for (const seed of seeds) {
    let level;
    try {
      level = generateLevel(seed, {
        biome: args.biome,
        track: args.track,
        tricks: args.tricks,
        swell: args.swell,
      });
    } catch (error) {
      console.log(`${padEnd(String(seed), 12)} the generator gave up: ${error.message}`);
      continue;
    }
    const row = rowOf(String(seed), level, conditions);
    rows.push(row);
    if (!args.stats) printRow(row);
  }
  if (args.stats) printStats(rows);
}

if (args.json) {
  mkdirSync(dirname(args.json), { recursive: true });
  writeFileSync(
    args.json,
    JSON.stringify(
      rows.map((row) => ({
        level: row.label,
        seed: row.level.seed,
        biome: row.level.biome,
        track: row.level.track,
        tricks: row.level.tricks,
        errors: row.errors,
        digest: levelDigest(row.level),
        rating: row.rating,
      })),
      null,
      2,
    ),
  );
  console.log(`wrote ${args.json}`);
}
