#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// LEVEL ANALYSIS CLI — the generator's scoreboard, on the command line.
//
// `make level` draws a level so it can be LOOKED at; this measures one so
// it can be ITERATED on. The loop it exists for:
//
//   1. change the generator
//   2. `make analyze SEED=7` — one seed, everything the rule book says
//   3. fix the worst finding
//   4. re-run the same seed; when it comes up clean, take another seed
//   5. `make analyze COUNT=24` — the sweep, before shipping
//
// Read the FINDINGS, not the stats: a finding names its rule (`R5.path`),
// so the fix is pointed at one paragraph of engine/mapgen/rules.ts. The
// generator already rejects sub-seeds until `analyzeLevel` is clean, so a
// finding here means the search ran out of attempts and shipped what it
// had — or that a check was added after the level was accepted.
//
//   npm run analyze                        # the example seeds
//   npm run analyze -- --seed 38           # one seed
//   npm run analyze -- --seeds 1,7,38      # a set, with a population summary
//   npm run analyze -- --count 24          # seeds 1..24, the sweep
//   npm run analyze -- --findings 40       # how many findings to print a seed
//   npm run analyze -- --json out.json     # every analysis, machine-readable
//
// Exits 1 when any seed has an error finding (or its generator gave up), so
// it can gate a change rather than only describe one.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "./lib/cli.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { analyzeLevel, generateLevel, engineVersion, rulesAtPace } = await import(
  join(root, "engine/index.ts")
);

const DEFAULT_SEEDS = [1, 7, 38, 123];

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", help: "one seed" },
    seeds: { kind: "list", help: "several seeds, comma-separated" },
    count: { kind: "number", help: "seeds 1..N — the sweep" },
    findings: { kind: "number", default: 12, help: "findings to print per seed" },
    track: {
      kind: "string",
      default: "coast",
      help: "coast (a shore sprint) or circuit (a lap at sea)",
    },
    pace: {
      kind: "number",
      default: 1,
      help: "the speed class the level is built for (R32) — 1 is STOCK",
    },
    ramp: {
      kind: "number",
      default: 1,
      help: "R33's ramp dial — the multiple of R8's stock deck width; 1 is STOCK",
    },
    json: { kind: "string", help: "write every analysis to this file" },
  },
  "usage: npm run analyze -- [--seed n | --seeds a,b,c | --count n] [--track coast|circuit] [--pace k] [--ramp k] [--findings n] [--json path]",
);
const seeds = args.seeds
  ? args.seeds.map(Number)
  : args.seed !== undefined
    ? [args.seed]
    : args.count !== undefined
      ? Array.from({ length: args.count }, (_, i) => i + 1)
      : DEFAULT_SEEDS;

const pad = (v, n) => String(v).padStart(n);
const padEnd = (v, n) => String(v).padEnd(n);
const mark = { error: "!!", warn: " !" };
const R = rulesAtPace(args.pace, args.ramp);

// The rules quoted are the ones this TRACK was built to: a circuit answers
// to R29's offshore floor and R30's whole ride, not to R1's coastal band
// and R10's sprint, and a header quoting the wrong chapter is a reader
// checking the numbers against a rule the level never had.
const circuit = args.track === "circuit";
console.log(
  `analyze — engine ${engineVersion} · ${args.track} · class ${args.pace} · ramp ×${args.ramp} · ` +
    `seeds ${seeds.join(",")} · ` +
    (circuit
      ? `rules: ${R.circuit.inshore.min}–${R.circuit.inshore.max} m off the beach, ` +
        `out to ${R.circuit.reach.min}–${R.circuit.reach.max} m, depth ≥ ${R.course.minDepth} m, ` +
        `gates ${R.gate.spacing.min}–${R.gate.spacing.max} m, ` +
        `ride ${R.circuit.length.min}–${R.circuit.length.max} m over ${R.circuit.laps.min}–${R.circuit.laps.max} laps, ` +
        `run-up ${R.ramp.runUp} m`
      : `rules: offshore ${R.course.offshore.min}–${R.course.offshore.max} m, depth ≥ ${R.course.minDepth} m, ` +
        `gates ${R.gate.spacing.min}–${R.gate.spacing.max} m, length ${R.course.length.min}–${R.course.length.max} m, ` +
        `run-up ${R.ramp.runUp} m`),
);
console.log(
  [
    padEnd("seed", 6),
    pad("ok", 3),
    pad("gates", 6),
    pad("air", 4),
    pad("km", 6),
    pad("minD", 6),
    pad("off min", 8),
    pad("off max", 8),
    pad("clear", 6),
    pad("land", 5),
    pad("deep", 5),
    pad("rocks", 6),
    pad("pods", 5),
    pad("life", 5),
    pad("wind", 5),
    pad("hour", 5),
    pad("sky", 9),
    pad("err", 4),
    pad("warn", 5),
    pad("ms", 5),
  ].join(" "),
);

const reports = [];
let failed = 0;
for (const seed of seeds) {
  let level;
  try {
    level = generateLevel(seed, { track: args.track, pace: args.pace, rampWidth: args.ramp });
  } catch (err) {
    console.log(`${padEnd(seed, 6)}  !! the generator gave up: ${err.message}`);
    failed += 1;
    reports.push({ seed, ok: false, findings: [], error: err.message });
    continue;
  }
  const a = analyzeLevel(level);
  reports.push(a);
  const s = a.stats;
  const errors = a.findings.filter((f) => f.severity === "error").length;
  const warns = a.findings.length - errors;
  console.log(
    [
      padEnd(seed, 6),
      pad(a.ok ? "ok" : "NO", 3),
      pad(s.gates, 6),
      pad(s.airGates, 4),
      pad((s.length / 1000).toFixed(2), 6),
      pad(s.minDepth.toFixed(1), 6),
      pad(s.minOffshore.toFixed(0), 8),
      pad(s.maxOffshore.toFixed(0), 8),
      pad(s.minClearance.toFixed(1), 6),
      pad(s.maxLand.toFixed(0), 5),
      pad(s.maxDepth.toFixed(0), 5),
      pad(s.solids, 6),
      pad(s.pods, 5),
      pad(s.animals, 5),
      pad(s.windSpeed.toFixed(1), 5),
      pad(s.hour.toFixed(1), 5),
      pad(s.weather, 9),
      pad(errors, 4),
      pad(warns, 5),
      pad(a.ms, 5),
    ].join(" "),
  );
  const shown = a.findings.slice(0, args.findings);
  for (const f of shown) {
    const at = f.at ? ` (${f.at.x.toFixed(0)}, ${f.at.z.toFixed(0)})` : "";
    console.log(`  ${mark[f.severity]} ${padEnd(f.code, 18)} ${f.message}${at}`);
  }
  if (a.findings.length > shown.length) {
    console.log(`     … and ${a.findings.length - shown.length} more`);
  }
  if (!a.ok) failed += 1;
}

// ── The population: what is wrong with the GENERATOR rather than a seed ─
if (reports.length > 1) {
  const good = reports.filter((r) => r.stats);
  const mean = (pick) => good.reduce((sum, r) => sum + pick(r.stats), 0) / Math.max(1, good.length);
  const lo = (pick) => Math.min(...good.map((r) => pick(r.stats)));
  const hi = (pick) => Math.max(...good.map((r) => pick(r.stats)));
  const range = (pick, d = 0) => `${lo(pick).toFixed(d)}–${hi(pick).toFixed(d)}`;
  console.log("");
  console.log(
    `${good.length}/${reports.length} levels built · mean ${mean((s) => s.gates).toFixed(1)} gates ` +
      `(${range((s) => s.gates)}), ${mean((s) => s.airGates).toFixed(1)} air (${range((s) => s.airGates)}), ` +
      `${(mean((s) => s.length) / 1000).toFixed(2)} km (${range((s) => s.length / 1000, 2)}), ` +
      `min depth ${range((s) => s.minDepth, 1)} m, offshore ${range((s) => s.minOffshore)}…${range((s) => s.maxOffshore)} m, ` +
      `clearance ${range((s) => s.minClearance, 1)} m, ${mean((s) => s.solids).toFixed(0)} rocks, ` +
      `${mean((s) => s.pods).toFixed(1)} pods of ${mean((s) => s.animals).toFixed(0)} animals, ` +
      `wind ${range((s) => s.windSpeed, 1)} m/s, ${(good.reduce((a, r) => a + r.ms, 0) / good.length).toFixed(0)} ms each`,
  );
  const tally = new Map();
  for (const r of reports) {
    for (const f of r.findings) {
      const key = `${mark[f.severity]} ${f.code}`;
      tally.set(key, (tally.get(key) ?? 0) + 1);
    }
  }
  const worst = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  if (worst.length > 0) {
    console.log("\n  most common findings across the sweep:");
    for (const [code, count] of worst) {
      const onSeeds = reports.filter((r) => r.findings.some((f) => code.endsWith(f.code))).length;
      console.log(`    ${padEnd(code, 22)} ${pad(count, 4)}  on ${onSeeds} seed(s)`);
    }
  }
}

if (args.json) {
  writeFileSync(args.json, `${JSON.stringify(reports, null, 2)}\n`);
  console.log(`\nwrote ${args.json}`);
}

if (failed > 0) {
  console.log(`\n${failed} of ${reports.length} seed(s) failed`);
  process.exit(1);
}
