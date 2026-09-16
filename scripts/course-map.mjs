#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CLOSED-COURSE SCHEMATIC — the one-lap picture beside `make score`.
//
// It deliberately omits the scenic world map and draws only what course
// judgement needs: curve severity, checkpoint order, start/finish, rounding
// buoys, ramp run-up/landing corridors, nearby hazards, and every wave band
// from the real sea state. Output is written under previews/.
//
//   npm run course -- --seed 38
//   npm run course -- --seed 7 --biome mangrove --size 1400
//   npm run course -- --seed 38 --pace 1.5 --ramp 2 --out fast-wide

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "./lib/cli.mjs";
import { renderCourseSchematic } from "./lib/course-draw.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { analyzeLevel, createGame, generateLevel, BIOME_IDS, isBiomeId } = await import(
  join(root, "engine/index.ts")
);

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 1, help: "the circuit's seed" },
    biome: {
      kind: "string",
      default: "taiga",
      help: "which coast the circuit stands off (taiga, mangrove)",
    },
    pace: { kind: "number", default: 1, help: "R32 speed class; 1 is STOCK" },
    ramp: { kind: "number", default: 1, help: "R33 ramp-width multiple; 1 is STOCK" },
    size: { kind: "number", default: 1120, help: "map panel size in pixels" },
    out: { kind: "string", help: "file name under previews/ (no extension)" },
    json: { kind: "flag", help: "also print the scoring report as JSON" },
  },
  "usage: npm run course -- --seed n [--biome taiga|mangrove] [--pace k] [--ramp k] [--size px] [--out name] [--json]",
);
if (!isBiomeId(args.biome)) {
  console.error(`unknown biome "${args.biome}" (${BIOME_IDS.join(", ")})`);
  process.exit(2);
}
if (args.size < 480) {
  console.error(`size must be at least 480 px (got ${args.size})`);
  process.exit(2);
}

const level = generateLevel(args.seed, {
  biome: args.biome,
  track: "circuit",
  pace: args.pace,
  rampWidth: args.ramp,
});
const analysis = analyzeLevel(level);
if (!analysis.closedCourse) throw new Error("the analyzer returned no closed-course score");
const game = createGame({ seed: args.seed, level, quiet: true });

const kinds = ["ocean", "local", "swell"];
const waveBands = [];
for (const kind of kinds) {
  let x = 0;
  let z = 0;
  let energy = 0;
  for (const component of game.sea.components) {
    if (component.band !== kind) continue;
    const weight = component.amp * component.amp;
    x += component.dirX * weight;
    z += component.dirZ * weight;
    energy += weight;
  }
  if (energy <= 0) continue;
  const heading = Math.atan2(x, z);
  const band = game.sea.bands.find((candidate) => candidate.kind === kind);
  waveBands.push({
    kind,
    heading,
    degrees: ((heading * 180) / Math.PI + 360) % 360,
    hs: band?.hs ?? 0,
    tp: band?.tp ?? 0,
  });
}

const title = `SEED ${args.seed}  IJSBA CLOSED COURSE  ${analysis.closedCourse.score.toFixed(1)}%`;
const canvas = renderCourseSchematic({
  level,
  analysis,
  waveBands,
  size: args.size,
  title,
});
const outDir = join(root, "previews");
mkdirSync(outDir, { recursive: true });
const name = args.out ?? `course-${args.seed}`;
const png = join(outDir, `${name}.png`);
const report = {
  seed: args.seed,
  biome: level.biome,
  pace: level.pace,
  rampWidth: level.rampWidth,
  waves: waveBands,
  score: analysis.closedCourse,
  findings: analysis.findings,
};
writeFileSync(png, canvas.toPng());
writeFileSync(join(outDir, `${name}.json`), JSON.stringify(report, null, 2));
console.log(
  `seed ${args.seed} · ${level.course.laps} laps · ${level.course.lapGates} checkpoints/lap · ` +
    `${analysis.closedCourse.score.toFixed(1)}% · ${waveBands.map((band) => `${band.kind} ${band.degrees.toFixed(0)}°`).join(", ")}`,
);
console.log(`wrote ${png} (${canvas.width}×${canvas.height}) and ${join(outDir, `${name}.json`)}`);
if (args.json) console.log(JSON.stringify(report, null, 2));
