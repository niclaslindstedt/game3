#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BALANCE TABLE: the bot rides generated levels through the REAL
// engine — createGame, step, botInput — with no renderer attached, and
// prints what happened per seed and craft. This is the measuring stick for
// every handling, water and generator change: run it before and after,
// read the diff, paste both tables in the PR (docs/simulation.md says what
// each column means and which movements are regressions).
//
//   npm run sim                            # four seeds × four crafts
//   npm run sim -- --seeds 38,39,40        # specific seeds
//   npm run sim -- --craft skiff           # one craft (or a,b list)
//   npm run sim -- --max 400               # give a run longer to finish
//   npm run sim -- --json examples/sim-report.json
//
// CI's `make sim` job: exits non-zero when a craft finishes NO seed at all
// — a hull that cannot get round any course is a broken hull, not a slow
// one — and prints the digests, which are what a determinism regression
// shows up in first.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs, craftList } from "./lib/cli.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { simulateStage, SIM_SECONDS, CRAFT_IDS, engineVersion, TUNING } = await import(
  join(root, "engine/index.ts")
);

/** The default seed set — the ones `examples/seeds.md` describes, so the
 * table CI prints is a table somebody has looked at the plans of. */
const DEFAULT_SEEDS = [1, 7, 38, 123];

const args = parseArgs(
  process.argv.slice(2),
  {
    seeds: { kind: "list", default: DEFAULT_SEEDS, help: "seeds to ride, comma-separated" },
    track: {
      kind: "string",
      default: "coast",
      help: "coast (a shore sprint) or circuit (a lap at sea)",
    },
    craft: { kind: "string", default: "all", help: "craft id, a comma list, or all" },
    // The engine states the cap (`SIM_SECONDS`); the flag only overrides it.
    max: { kind: "number", default: SIM_SECONDS, help: "give up after this much run time, s" },
    json: { kind: "string", help: "also write the rows (events dropped) to this file" },
    assist: {
      kind: "number",
      help: "the arcade assist, 0..1, BOTH hands (the tuning's defaults when left out); 0 is the bare physics",
    },
    "ramp-assist": {
      kind: "number",
      help: "the ramp's hand alone, 0..1 — overrides --assist for the deck",
    },
  },
  "usage: npm run sim -- [--seeds a,b,c] [--track coast|circuit] [--craft id] [--max s] [--json path] [--assist 0..1] [--ramp-assist 0..1]",
);
const seeds = args.seeds.map(Number);
if (seeds.some((s) => !Number.isInteger(s))) {
  console.error(`--seeds wants integers, got ${args.seeds.join(",")}`);
  process.exit(2);
}
const crafts = craftList(args.craft, CRAFT_IDS);

const pad = (v, n) => String(v).padStart(n);
const kmh = (ms) => (ms * 3.6).toFixed(0);

console.log(
  `sim — engine ${engineVersion} at ${TUNING.physicsHz} Hz · ${args.track} · seeds ${seeds.join(",")} · ` +
    `crafts ${crafts.join(",")} · max ${args.max} s`,
);
console.log(
  [
    pad("seed", 5),
    "craft".padEnd(7),
    pad("fin", 4),
    pad("time", 7),
    pad("gates", 6),
    pad("miss", 4),
    pad("top", 6),
    pad("air", 5),
    pad("lnch", 4),
    pad("dive", 4),
    pad("hit", 4),
    pad("grnd", 4),
    pad("rst", 4),
    pad("maxHs", 6),
    pad("digest", 9),
  ].join(" "),
);

const rows = [];
for (const seed of seeds) {
  for (const craft of crafts) {
    const r = simulateStage({
      seed,
      craft,
      track: args.track,
      maxSeconds: args.max,
      assist: args.assist,
      rampAssist: args["ramp-assist"],
    });
    rows.push(r);
    console.log(
      [
        pad(seed, 5),
        craft.padEnd(7),
        pad(r.finished ? "yes" : "NO", 4),
        pad(r.time.toFixed(1), 7),
        pad(`${r.gatesPassed}/${r.gates}`, 6),
        pad(r.gatesMissed, 4),
        pad(kmh(r.topSpeed), 6),
        pad(r.airTime.toFixed(1), 5),
        pad(r.launches, 4),
        pad(r.dives, 4),
        pad(r.hits, 4),
        pad(r.groundings, 4),
        pad(r.resets, 4),
        pad(r.maxHs.toFixed(2), 6),
        pad(r.digest, 9),
      ].join(" "),
    );
  }
}

// ── The footer: one line per craft, over every seed it rode ────────────
// Pace rather than time, because the seeds build courses of different
// lengths and times across them cannot be added up.
console.log("");
let dead = [];
for (const craft of crafts) {
  const own = rows.filter((r) => r.craft === craft);
  const done = own.filter((r) => r.finished);
  const sum = (f) => own.reduce((a, r) => a + f(r), 0);
  const pace = done.length
    ? done.reduce((a, r) => a + (r.courseLength / r.time) * 3.6, 0) / done.length
    : 0;
  console.log(
    `${craft.padEnd(7)} ${done.length}/${own.length} finished · ` +
      `pace ${pace.toFixed(1)} km/h · top ${kmh(Math.max(...own.map((r) => r.topSpeed)))} km/h · ` +
      `air ${(sum((r) => r.airTime) / own.length).toFixed(1)} s/run · ` +
      `launches ${sum((r) => r.launches)} · dives ${sum((r) => r.dives)} · ` +
      `hits ${sum((r) => r.hits)} · groundings ${sum((r) => r.groundings)} · ` +
      `resets ${sum((r) => r.resets)} · missed ${sum((r) => r.gatesMissed)}`,
  );
  if (done.length === 0) dead.push(craft);
}
const finished = rows.filter((r) => r.finished).length;
console.log(`\n${finished}/${rows.length} runs finished`);

if (args.json) {
  const withoutEvents = rows.map((r) => {
    const copy = { ...r };
    delete copy.events;
    return copy;
  });
  writeFileSync(args.json, `${JSON.stringify(withoutEvents, null, 2)}\n`);
  console.log(`wrote ${args.json}`);
}

if (dead.length > 0) {
  console.error(`\n!! ${dead.join(", ")} finished no seed at all`);
  process.exit(1);
}
