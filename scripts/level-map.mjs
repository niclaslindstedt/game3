#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LEVEL MAP — a level drawn from above and described, from nothing but
// the engine.
//
// This is the tool for reasoning about a level WITHOUT riding it: "the
// second air gate on seed 38" is a claim, and this turns it into a picture
// with `G6` and `J6` on it and a row in a table saying where G6 stands,
// how far offshore, how deep the water under it is, how far it is from the
// gate before, what the ramp climbs, how far and how high the ring is past
// the lip, and the speed the bot's own arithmetic says the hinge needs. It
// loads the engine and nothing else — no three.js, no browser, no build —
// so it runs in a couple of seconds on any seed.
//
//   npm run level -- --seed 38               # previews/level-38.png + .txt
//   npm run level -- --seed 38 --scale 2     # two pixels a metre
//   npm run level -- --seed 38 --craft otter # the launch speeds for a hull
//   npm run level -- --seed 38 --json        # the listing as data, too
//   npm run level -- --seed 38 --out plan    # previews/plan.png
//
// Writes previews/level-<seed>.png and previews/level-<seed>.txt (the same
// table the run prints).

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "./lib/cli.mjs";
import { renderLevelMap } from "./lib/level-draw.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const {
  generateLevel,
  flowAt,
  sampleField,
  cumulative,
  craftById,
  topSpeedOf,
  faunaById,
  faunaCount,
  rarityOf,
  CRAFT_IDS,
  LEVEL_RULES,
} = await import(join(root, "engine/index.ts"));
// The hinge speed a ring asks for is the bot's arithmetic (engine/sim/
// bot.ts); it is not on the engine's public surface yet, so it is read
// from the module that owns it.
const { launchSpeedFor } = await import(join(root, "engine/sim/bot.ts"));

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 1, help: "the level's seed" },
    scale: { kind: "number", default: 1, help: "pixels per metre" },
    craft: { kind: "string", default: "skiff", help: "hull the launch speeds are quoted for" },
    out: { kind: "string", help: "file name under previews/ (no extension)" },
    json: { kind: "flag", help: "also print the listing as JSON" },
  },
  "usage: npm run level -- --seed n [--scale px/m] [--craft id] [--out name] [--json]",
);
if (!CRAFT_IDS.includes(args.craft)) {
  console.error(`unknown craft "${args.craft}" (${CRAFT_IDS.join(", ")})`);
  process.exit(2);
}

// ── Build it ────────────────────────────────────────────────────────────
const t0 = Date.now();
const level = generateLevel(args.seed);
const built = Date.now() - t0;
const depthAt = (x, z) => -sampleField(level.ground, x, z);
const offshoreAt = (x, z) => sampleField(level.offshore, x, z);
const deg = (rad) => ((rad * 180) / Math.PI + 360) % 360;

/** Station along the path, m: the nearest point of the polyline to (x, z)
 * and how far along it that is — so consecutive gates measure the ride
 * between them, not the chord. */
const path = level.course.path;
const cum = cumulative(path);
function stationOf(x, z) {
  let best = Infinity;
  let station = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const ax = path[i].x;
    const az = path[i].z;
    const bx = path[i + 1].x;
    const bz = path[i + 1].z;
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
    const qx = ax + dx * t;
    const qz = az + dz * t;
    const d = Math.hypot(x - qx, z - qz);
    if (d < best) {
      best = d;
      station = cum[i] + Math.sqrt(len2) * t;
    }
  }
  return station;
}

// ── The listing ─────────────────────────────────────────────────────────
const spec = craftById(args.craft);
const gates = level.course.gates;
const startStation = stationOf(level.start.x, level.start.z);
let prev = startStation;
const rows = gates.map((g) => {
  const station = stationOf(g.x, g.z);
  const row = {
    index: g.index + 1,
    id: g.id,
    kind: g.kind,
    x: g.x,
    z: g.z,
    heading: deg(g.heading),
    station,
    fromPrevious: station - prev,
    offshore: offshoreAt(g.x, g.z),
    depth: depthAt(g.x, g.z),
  };
  prev = station;
  if (g.kind === "air" && g.ramp) {
    const r = g.ramp;
    const sh = Math.sin(r.heading);
    const ch = Math.cos(r.heading);
    // The lip stands `length` up the deck from the hinge (collision.ts's
    // convention, the one the hull rides); the ring is `along` past the
    // hinge on the same axis.
    const along = (g.x - r.x) * sh + (g.z - r.z) * ch;
    const lipY = r.length * Math.tan(r.angle);
    row.ramp = {
      id: r.id,
      x: r.x,
      z: r.z,
      angle: (r.angle * 180) / Math.PI,
      length: r.length,
      width: r.width,
      lipY,
      depthAtHinge: depthAt(r.x, r.z),
      leadToRing: along,
      lipToRing: along - r.length,
      lipToRingHeight: g.y - lipY,
      ringHeight: g.y,
      launchSpeed: Object.fromEntries(
        CRAFT_IDS.map((id) => {
          const s = craftById(id);
          return [id, launchSpeedFor(g, s.cog.y, topSpeedOf(s))];
        }),
      ),
    };
  }
  return row;
});

const solidsByKind = {};
for (const s of level.solids) solidsByKind[s.kind] = (solidsByKind[s.kind] ?? 0) + 1;
// R20 — the roster: what swims here, commonest first, with the word for how
// often a coast carries it. A pod is a group, so both counts are printed.
const roster = new Map();
for (const p of level.fauna) {
  const row = roster.get(p.species) ?? { pods: 0, animals: 0 };
  row.pods += 1;
  row.animals += p.count;
  roster.set(p.species, row);
}
const rosterLine =
  roster.size === 0
    ? "nothing swims here"
    : [...roster.entries()]
        .sort((a, b) => faunaById(b[0]).perKm - faunaById(a[0]).perKm)
        .map(
          ([id, row]) =>
            `${row.animals} ${faunaById(id).name.toLowerCase()} in ${row.pods} pod${row.pods > 1 ? "s" : ""} (${rarityOf(faunaById(id).perKm)})`,
        )
        .join(", ");
const airCount = gates.filter((g) => g.kind === "air").length;
const hour = `${String(Math.floor(level.hour)).padStart(2, "0")}:${String(
  Math.floor((level.hour % 1) * 60),
).padStart(2, "0")}`;
const w = level.wind;
const b = level.bounds;
const pad = (v, n) => String(v).padStart(n);
const padEnd = (v, n) => String(v).padEnd(n);

const heading = `SEED ${args.seed} — ${level.biome}, ${level.weather} sky, wind ${w.speed.toFixed(1)} m/s from ${deg(w.from).toFixed(0)}°, ${hour}, water ${level.water.temperature.toFixed(1)} °C at ${level.water.density} kg/m³`;
const statLine =
  `${(level.course.length / 1000).toFixed(2)} km, ${gates.length} gates (${airCount} in the air), ` +
  `${level.solids.length} rocks (${Object.entries(solidsByKind)
    .map(([k, n]) => `${n} ${k}`)
    .join(", ")}), ` +
  `${(b.maxX - b.minX).toFixed(0)} × ${(b.maxZ - b.minZ).toFixed(0)} m on ${level.ground.cell} m cells, ` +
  `start (${level.start.x.toFixed(0)}, ${level.start.z.toFixed(0)}) facing ${deg(level.start.heading).toFixed(0)}°, ` +
  `built in ${built} ms`;
// R25, R26 — the two things about a level that are not on the gate table:
// how far out the ocean leg reaches and what it goes round, and how far the
// river carries the water on past the race.
const mark = level.solids.find((s) => s.kind === "mark");
const river = level.river;
const riverInland =
  river.length > 1
    ? Math.hypot(river[river.length - 1].x - river[0].x, river[river.length - 1].z - river[0].z)
    : 0;
let riverRun = 0;
for (let i = 0; i + 1 < river.length; i++) {
  riverRun += Math.hypot(river[i + 1].x - river[i].x, river[i + 1].z - river[i].z);
}
const legLine = mark
  ? `ocean leg: rounds ${mark.id} at (${mark.x.toFixed(0)}, ${mark.z.toFixed(0)}) — ` +
    `${mark.r.toFixed(1)} m across, ${mark.top.toFixed(0)} m out of the water, ` +
    `${sampleField(level.offshore, mark.x, mark.z).toFixed(0)} m offshore ` +
    `in ${(-sampleField(level.ground, mark.x, mark.z)).toFixed(0)} m of water`
  : "ocean leg: none";
const riverLine =
  river.length > 1
    ? `river: ${riverRun.toFixed(0)} m of water from its mouth at (${river[0].x.toFixed(0)}, ` +
      `${river[0].z.toFixed(0)}), reaching ${riverInland.toFixed(0)} m inland to a head ` +
      `${(2 * sampleField(level.offshore, river[river.length - 1].x, river[river.length - 1].z)).toFixed(1)} m wide ` +
      `in ${(-sampleField(level.ground, river[river.length - 1].x, river[river.length - 1].z)).toFixed(2)} m of water`
    : "river: none";
// R27 — and what that water is DOING. Read off the level's own baked field
// rather than recomputed, at the mouth and at the reach where the channel
// has closed to a quarter of the plan it started on.
const flow = { x: 0, z: 0 };
const currentAt = (p) => {
  flowAt(level.flow, p.x, p.z, flow);
  return Math.hypot(flow.x, flow.z);
};
const flowLine =
  river.length > 1
    ? `current: ${currentAt(river[0]).toFixed(2)} m/s at the mouth, ` +
      `${currentAt(river[Math.round((river.length - 1) * 0.75)]).toFixed(2)} m/s three quarters up, ` +
      `${currentAt(river[river.length - 1]).toFixed(2)} m/s at the head`
    : "current: none";
const lines = [
  heading,
  statLine,
  legLine,
  riverLine,
  flowLine,
  `sea life: ${rosterLine}`,
  "",
  "  #   ID   KIND   AT (X, Z)        HDG  STATION  FROM PREV  OFFSHORE  DEPTH",
];
for (const r of rows) {
  lines.push(
    `  ${padEnd(r.index, 3)} ${padEnd(r.id, 4)} ${padEnd(r.kind, 6)} ` +
      `${padEnd(`(${r.x.toFixed(0)}, ${r.z.toFixed(0)})`, 16)} ${pad(r.heading.toFixed(0) + "°", 4)} ` +
      `${pad(r.station.toFixed(0) + " m", 8)} ${pad(r.fromPrevious.toFixed(0) + " m", 10)} ` +
      `${pad(r.offshore.toFixed(0) + " m", 9)} ${pad(r.depth.toFixed(1) + " m", 6)}` +
      (r.index === rows.length ? "  FINISH" : ""),
  );
  if (r.ramp) {
    const rp = r.ramp;
    lines.push(
      `        ${rp.id} at (${rp.x.toFixed(0)}, ${rp.z.toFixed(0)}): ${rp.angle.toFixed(0)}° × ${rp.length.toFixed(1)} m ` +
        `(lip ${rp.lipY.toFixed(2)} m up, ${rp.depthAtHinge.toFixed(1)} m of water at the hinge), ` +
        `ring ${rp.leadToRing.toFixed(1)} m past the hinge at ${rp.ringHeight.toFixed(2)} m — ` +
        `lip → ring ${rp.lipToRing.toFixed(1)} m out, ${rp.lipToRingHeight >= 0 ? "+" : ""}${rp.lipToRingHeight.toFixed(2)} m up`,
    );
    lines.push(
      `        hinge speed the ring asks for: ` +
        CRAFT_IDS.map(
          (id) =>
            `${id} ${(rp.launchSpeed[id] * 3.6).toFixed(0)} km/h${id === args.craft ? "*" : ""}`,
        ).join(" · ") +
        `  (run-up ${LEVEL_RULES.ramp.runUp} m, ${spec.name}'s top ${spec.topSpeed} km/h)`,
    );
  }
}
lines.push(`  start → G1 is ${(rows[0].station - startStation).toFixed(0)} m of straight water`);
const text = lines.join("\n");
console.log(text);
if (args.json) {
  console.log(
    JSON.stringify(
      {
        seed: args.seed,
        biome: level.biome,
        wind: w,
        hour: level.hour,
        weather: level.weather,
        water: level.water,
        gates: rows,
      },
      null,
      1,
    ),
  );
}

// ── Draw it ─────────────────────────────────────────────────────────────
const outDir = join(root, "previews");
mkdirSync(outDir, { recursive: true });
const name = args.out ?? `level-${args.seed}`;
writeFileSync(join(outDir, `${name}.txt`), `${text}\n`);
const canvas = renderLevelMap({
  level,
  scale: args.scale,
  title: `SEED ${args.seed}  ${level.biome.toUpperCase()}  ${level.weather.toUpperCase()}  WIND ${w.speed.toFixed(1)} M/S FROM ${deg(w.from).toFixed(0)}°  ${hour}`,
  lines: [
    `${(level.course.length / 1000).toFixed(2)} KM, ${gates.length} GATES, ${airCount} IN THE AIR`,
    `RIVER ${(riverInland / 1000).toFixed(2)} KM INLAND`,
    `${level.solids.length} ROCKS, ${faunaCount(level.fauna)} ANIMALS`,
    `WATER ${level.water.temperature.toFixed(0)}°C`,
    `${args.scale} PX/M`,
  ],
});
const file = join(outDir, `${name}.png`);
writeFileSync(file, canvas.toPng());
console.log(
  `\nwrote ${file} (${canvas.width}×${canvas.height}) and ${join(outDir, `${name}.txt`)}`,
);
