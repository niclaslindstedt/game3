#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// IJSBA CLOSED-COURSE SCORE — the generator's circuit-quality dashboard.
//
// The official rules define the race format and its marker semantics. Sea
// Haven's R-rules translate the dimensions IJSBA leaves to the Race Director
// into measurable water depth, clearance, curve and ramp checks. This script
// prints both layers as one 0–100 score and exits non-zero below the project's
// 90% acceptance floor.
//
//   npm run score -- --seed 38
//   npm run score -- --count 24
//   npm run score -- --seeds 1,7,38 --checks
//   npm run score -- --count 24 --biome mangrove --json previews/score.json

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "./lib/cli.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { analyzeLevel, generateLevel, engineVersion, CLOSED_COURSE_FLOOR, BIOME_IDS, isBiomeId } =
  await import(join(root, "engine/index.ts"));

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", help: "one seed" },
    seeds: { kind: "list", help: "several seeds, comma-separated" },
    count: { kind: "number", help: "seeds 1..N — the generator sweep" },
    biome: {
      kind: "string",
      default: "taiga",
      help: "which coast the circuit stands off (taiga, mangrove, arctic, karst)",
    },
    pace: { kind: "number", default: 1, help: "R32 speed class; 1 is STOCK" },
    ramp: { kind: "number", default: 1, help: "R33 ramp-width multiple; 1 is STOCK" },
    floor: {
      kind: "number",
      default: CLOSED_COURSE_FLOOR,
      help: "minimum accepted score, percent",
    },
    checks: { kind: "flag", help: "print every check under each metric" },
    findings: { kind: "number", default: 8, help: "findings to print per seed" },
    json: { kind: "string", help: "write the complete reports to this file" },
  },
  "usage: npm run score -- [--seed n | --seeds a,b,c | --count n] [--biome taiga|mangrove|arctic|karst] [--pace k] [--ramp k] [--floor 0..100] [--checks] [--findings n] [--json path]",
);

if (!isBiomeId(args.biome)) {
  console.error(`unknown biome "${args.biome}" (${BIOME_IDS.join(", ")})`);
  process.exit(2);
}
if (args.floor < 0 || args.floor > 100) {
  console.error(`floor must be in 0..100 (got ${args.floor})`);
  process.exit(2);
}

const seeds = args.seeds
  ? args.seeds.map(Number)
  : args.seed !== undefined
    ? [args.seed]
    : args.count !== undefined
      ? Array.from({ length: args.count }, (_, i) => i + 1)
      : [1, 7, 38, 123];

const pad = (value, width) => String(value).padStart(width);
const padEnd = (value, width) => String(value).padEnd(width);
const bar = (score) => " ▁▂▃▄▅▆▇█"[Math.min(8, Math.max(0, Math.round(score * 8)))];

console.log(
  `IJSBA closed-course score — engine ${engineVersion} · ${args.biome} · class ${args.pace} · ` +
    `ramp ×${args.ramp} · floor ${args.floor}% · seeds ${seeds.join(",")}`,
);
console.log(
  [
    padEnd("seed", 6),
    pad("score", 6),
    pad("format", 9),
    pad("turns", 9),
    pad("markers", 9),
    pad("start", 9),
    pad("safety", 9),
    pad("laps", 5),
    pad("g/lap", 6),
    pad("km", 6),
    pad("err", 4),
    pad("ms", 5),
  ].join(" "),
);

const reports = [];
for (const seed of seeds) {
  try {
    const level = generateLevel(seed, {
      biome: args.biome,
      track: "circuit",
      pace: args.pace,
      rampWidth: args.ramp,
    });
    const analysis = analyzeLevel(level);
    const score = analysis.closedCourse;
    if (!score) throw new Error("the analyzer returned no closed-course score");
    const errors = analysis.findings.filter((finding) => finding.severity === "error");
    const byId = new Map(score.metrics.map((group) => [group.id, group]));
    console.log(
      [
        padEnd(seed, 6),
        pad(score.score.toFixed(1), 6),
        ...["format", "turns", "markers", "start", "safety"].map((id) => {
          const value = byId.get(id)?.score ?? 0;
          return pad(`${bar(value)} ${(value * 100).toFixed(0)}`, 9);
        }),
        pad(level.course.laps, 5),
        pad(level.course.lapGates, 6),
        pad((level.course.length / 1000).toFixed(2), 6),
        pad(errors.length, 4),
        pad(analysis.ms, 5),
      ].join(" "),
    );
    if (args.checks) {
      for (const group of score.metrics) {
        console.log(`    ${padEnd(group.label, 20)} ${(group.score * 100).toFixed(0)}%`);
        for (const check of group.checks) {
          const value = check.value === undefined ? "" : ` · ${Number(check.value.toFixed(3))}`;
          console.log(
            `      ${bar(check.score)} ${padEnd(`${group.id}.${check.id}`, 24)} ${pad(
              (check.score * 100).toFixed(0),
              3,
            )}%${value} · ${check.target} · ${check.source}`,
          );
        }
      }
    }
    for (const finding of analysis.findings.slice(0, args.findings)) {
      const at = finding.at ? ` (${finding.at.x.toFixed(0)}, ${finding.at.z.toFixed(0)})` : "";
      console.log(
        `  ${finding.severity === "error" ? "!!" : " !"} ${padEnd(finding.code, 18)} ${finding.message}${at}`,
      );
    }
    reports.push({ seed, level: { biome: level.biome, pace: level.pace }, analysis });
  } catch (error) {
    console.log(`${padEnd(seed, 6)}  !! generator gave up: ${error.message}`);
    reports.push({ seed, error: error.message });
  }
}

if (reports.length > 1) {
  const scored = reports.filter((report) => report.analysis?.closedCourse);
  if (scored.length > 0) {
    const scores = scored.map((report) => report.analysis.closedCourse.score);
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    console.log(
      `\n${scored.length}/${reports.length} scored · mean ${mean.toFixed(1)}% · ` +
        `range ${Math.min(...scores).toFixed(1)}–${Math.max(...scores).toFixed(1)}%`,
    );
  }
}

if (args.json) {
  writeFileSync(args.json, JSON.stringify(reports, null, 2));
  console.log(`\nwrote ${args.json}`);
}

const failed = reports.filter(
  (report) =>
    !report.analysis ||
    report.analysis.findings.some((finding) => finding.severity === "error") ||
    report.analysis.closedCourse.score < args.floor,
);
if (failed.length > 0) {
  console.log(
    `\n${failed.length} of ${reports.length} seed(s) failed: ${failed.map((report) => report.seed).join(", ")}`,
  );
  process.exit(1);
}
