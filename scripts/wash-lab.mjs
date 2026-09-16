#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WASH LAB — the waves the craft leaves in the water, from straight
// above, with the sea's own waves taken out.
//
// The wash (`engine/game/wash.ts`) is real water: the hull's probes read it
// and the water grid is displaced by it. But every camera in the game is a
// chase camera, so the V a rider looks back at is seen end-on and
// foreshortened, and a wave a hand's breadth high on a grid of metres reads
// as nothing at all from the saddle. So this asks the engine's own `washAt`
// for the whole picture and draws it, pure Node, no browser — one column a
// RIDE on the synthetic shore:
//
//   REST      the hull lying to in a chop: the rings its bob radiates
//   HUMP      the hull at its hump speed: the bow wave and the squat
//   CRUISE    up on the plane: the V, and how it narrows past the celerity
//   FLAT OUT  at the top of the throttle: the same V, narrower and lower
//   LANDING   a hull dropped onto calm water and riding on: the splash's ring
//
// Each column is the PLAN from above (the height as colour, a crest warm
// and a trough cold, the hull marked), the SECTION along the axis astern,
// and the section ACROSS the trail ten metres back — and the table under
// them prints what a picture cannot: the crest and the trough, how far off
// the track the wash still stands, how many sources are live, and what one
// sample of it costs. Required before and after any change to the wash.
//
//   npm run wash                       # previews/wash.png
//   npm run wash -- --craft marlin     # another hull
//   npm run wash -- --half 40          # a wider plan

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import process from "node:process";

import { parseArgs } from "./lib/cli.mjs";
import { createDrawing } from "./lib/draw.mjs";
import { aliasEngine } from "./lib/engine-alias.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
aliasEngine(root);
const {
  CRAFT_IDS,
  createGame,
  NEUTRAL_INPUT,
  placeRun,
  step,
  washAt,
  WASH_REACH,
  WASH_WAVELENGTH,
  TUNING,
  engineVersion,
} = await import(join(root, "engine/index.ts"));
const { syntheticLevel } = await import(join(root, "tests/support/synthetic.ts"));

const args = parseArgs(
  process.argv.slice(2),
  {
    craft: { kind: "string", default: "skiff", help: `which hull (${CRAFT_IDS.join(", ")})` },
    half: { kind: "number", default: 30, help: "half the plan's side, m" },
    cell: { kind: "number", default: 0.5, help: "the plan's cell, m" },
    out: { kind: "string", help: "file name under previews/ (no extension)" },
  },
  "usage: npm run wash -- [--craft id] [--half m] [--cell m] [--out name]",
);
if (!CRAFT_IDS.includes(args.craft)) {
  console.error(`unknown craft "${args.craft}" (${CRAFT_IDS.join(", ")})`);
  process.exit(2);
}

// ── The rides ───────────────────────────────────────────────────────────
// Every ride is the real engine on the synthetic shore's deep water, and
// the wash is read off the run's own sea afterwards.
const START = { x: 100, z: 200, heading: Math.PI / 2 };
function ride({ throttle, seconds, wind = 0, drop = 0 }) {
  const level = syntheticLevel({ windSpeed: wind });
  const state = createGame({ seed: 1, level, windSpeed: wind, craft: args.craft, quiet: true });
  placeRun(state, { ...START, speed: drop > 0 ? 12 : 0, height: drop });
  const input = { ...NEUTRAL_INPUT, throttle };
  for (let i = 0; i < Math.round(seconds * TUNING.physicsHz); i++) step(state, input);
  return state;
}
const RIDES = [
  { label: "REST IN A CHOP", throttle: 0, seconds: 8, wind: 8 },
  { label: "THE HUMP", throttle: 0.12, seconds: 10 },
  { label: "CRUISE", throttle: 0.35, seconds: 10 },
  { label: "FLAT OUT", throttle: 1, seconds: 10 },
  { label: "A LANDING", throttle: 0, seconds: 1.5, drop: 2 },
];

// ── The readings ────────────────────────────────────────────────────────
const sample = { height: 0, sx: 0, sz: 0, vx: 0, vy: 0, vz: 0 };
function washHeight(state, x, z) {
  return washAt(state.sea.washes, x, z, state.t, 1, sample).height;
}
/** The plan round the hull: heights on a grid, and what one sample cost. */
function plan(state) {
  const c = state.craft;
  const n = Math.round((2 * args.half) / args.cell);
  const h = new Float64Array(n * n);
  let lo = 0;
  let hi = 0;
  const t0 = performance.now();
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const v = washHeight(state, c.x - args.half + i * args.cell, c.z - args.half + j * args.cell);
      h[j * n + i] = v;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  const micros = ((performance.now() - t0) * 1000) / (n * n);
  return { n, h, lo, hi, micros };
}
/** How far off the track the wash still stands, m: the furthest sample
 * across the trail, ten metres astern, over five millimetres. */
function reachOf(state) {
  const c = state.craft;
  const ax = Math.sin(c.heading);
  const az = Math.cos(c.heading);
  const bx = c.x - ax * 10;
  const bz = c.z - az * 10;
  let reach = 0;
  for (let s = 0; s <= args.half; s += args.cell) {
    for (const side of [-1, 1]) {
      const v = washHeight(state, bx + side * s * az, bz - side * s * ax);
      if (Math.abs(v) > 0.005) reach = Math.max(reach, s);
    }
  }
  return reach;
}

const rows = RIDES.map((r) => {
  const state = ride(r);
  const c = state.craft;
  return {
    ...r,
    state,
    plan: plan(state),
    reach: reachOf(state),
    speed: c.speed,
    planing: c.planing,
    sources: state.wash.count,
  };
});

// ── The sheet ───────────────────────────────────────────────────────────
const INK = {
  bg: [14, 22, 30],
  panel: [22, 32, 42],
  frame: [70, 90, 110],
  label: [230, 236, 240],
  dim: [140, 155, 170],
  axis: [90, 110, 130],
  hull: [255, 220, 90],
  trace: [120, 200, 255],
  zero: [60, 80, 100],
};
/** A height as colour: the still water grey, a crest warm, a trough cold. */
function tone(v, scale) {
  const s = Math.max(-1, Math.min(1, v / scale));
  if (s >= 0) return [70 + 185 * s, 80 + 120 * s, 100 + 40 * s];
  return [70 + 20 * s, 80 + 30 * s, 100 - 150 * s];
}

const COL = rows.length;
const PLAN = 300;
const SEC_H = 90;
const GAP = 16;
const LEFT = 60;
const TOP = 60;
const W = LEFT + COL * (PLAN + GAP) + GAP;
const H = TOP + PLAN + 2 * (SEC_H + GAP) + 110;
const canvas = createDrawing(W, H, INK.bg);
canvas.text(
  `THE WASH — ${args.craft.toUpperCase()} ON THE SYNTHETIC SHORE · engine ${engineVersion} · λ ${WASH_WAVELENGTH.toFixed(1)} m · reach ${WASH_REACH.toFixed(0)} m`,
  LEFT,
  16,
  INK.label,
  1,
);
canvas.text("A  PLAN FROM ABOVE, WASH ONLY (CREST WARM, TROUGH COLD)", 8, TOP - 14, INK.dim, 1);
canvas.text(
  "B  ALONG THE AXIS, 10 M AHEAD TO 50 M ASTERN (M)",
  8,
  TOP + PLAN + GAP - 14,
  INK.dim,
  1,
);
canvas.text(
  "C  ACROSS THE TRAIL, 10 M ASTERN (M)",
  8,
  TOP + PLAN + 2 * GAP + SEC_H - 14,
  INK.dim,
  1,
);

const scale = Math.max(0.02, ...rows.map((r) => Math.max(-r.plan.lo, r.plan.hi)));
rows.forEach((r, k) => {
  const x0 = LEFT + k * (PLAN + GAP);
  const { n, h } = r.plan;
  const c = r.state.craft;
  // A — the plan, north up: +z is up the page, +x to the right.
  const px = PLAN / n;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      canvas.fillRect(
        x0 + i * px,
        TOP + (n - 1 - j) * px,
        px + 0.5,
        px + 0.5,
        tone(h[j * n + i], scale),
      );
    }
  }
  canvas.rect(x0, TOP, PLAN, PLAN, INK.frame);
  // The hull, as an arrow on its heading.
  const cx = x0 + PLAN / 2;
  const cz = TOP + PLAN / 2;
  const ax = Math.sin(c.heading);
  const az = Math.cos(c.heading);
  const L = (1.6 / args.cell) * px;
  canvas.line(cx - ax * L, cz + az * L, cx + ax * L, cz - az * L, INK.hull, 2);
  canvas.disk(cx + ax * L, cz - az * L, 3, INK.hull);
  // A ten-metre bar.
  const bar = (10 / args.cell) * px;
  canvas.line(x0 + 8, TOP + PLAN - 8, x0 + 8 + bar, TOP + PLAN - 8, INK.label, 2);
  canvas.text("10 M", x0 + 10, TOP + PLAN - 20, INK.label, 1);
  canvas.text(r.label, x0 + 4, TOP + 4, INK.label, 1);
  canvas.text(
    `${(r.speed * 3.6).toFixed(0)} KM/H · PLANING ${r.planing.toFixed(2)} · ${r.sources} SRC`,
    x0 + 4,
    TOP + 16,
    INK.dim,
    1,
  );

  // B — along the axis: 10 m ahead to 50 m astern.
  const by = TOP + PLAN + GAP;
  canvas.fillRect(x0, by, PLAN, SEC_H, INK.panel);
  canvas.rect(x0, by, PLAN, SEC_H, INK.frame);
  const mid = by + SEC_H / 2;
  canvas.line(x0, mid, x0 + PLAN, mid, INK.zero);
  const pts = [];
  for (let i = 0; i <= PLAN; i++) {
    const s = -10 + (60 * i) / PLAN;
    const v = washHeight(r.state, c.x - ax * s, c.z - az * s);
    pts.push([x0 + i, mid - (v / scale) * (SEC_H / 2 - 4)]);
  }
  canvas.polyline(pts, INK.trace, 1);
  const hullAt = x0 + (10 / 60) * PLAN;
  canvas.line(hullAt, by, hullAt, by + SEC_H, INK.hull);
  canvas.text("HULL", hullAt + 3, by + 3, INK.hull, 1);
  for (const s of [0, 20, 40])
    canvas.text(`${s}`, x0 + ((s + 10) / 60) * PLAN - 3, by + SEC_H + 2, INK.dim, 1);

  // C — across the trail, ten metres astern.
  const cy = by + SEC_H + GAP;
  canvas.fillRect(x0, cy, PLAN, SEC_H, INK.panel);
  canvas.rect(x0, cy, PLAN, SEC_H, INK.frame);
  const cmid = cy + SEC_H / 2;
  canvas.line(x0, cmid, x0 + PLAN, cmid, INK.zero);
  const across = [];
  for (let i = 0; i <= PLAN; i++) {
    const s = -args.half + (2 * args.half * i) / PLAN;
    const v = washHeight(r.state, c.x - ax * 10 + s * az, c.z - az * 10 - s * ax);
    across.push([x0 + i, cmid - (v / scale) * (SEC_H / 2 - 4)]);
  }
  canvas.polyline(across, INK.trace, 1);
  canvas.line(x0 + PLAN / 2, cy, x0 + PLAN / 2, cy + SEC_H, INK.zero);
  canvas.text(`±${(scale * 100).toFixed(0)} CM FULL SCALE`, x0 + 4, cy + SEC_H - 10, INK.dim, 1);
  canvas.text(
    `CREST ${(r.plan.hi * 100).toFixed(1)} CM · TROUGH ${(-r.plan.lo * 100).toFixed(1)} CM · REACH ${r.reach.toFixed(0)} M · ${r.plan.micros.toFixed(2)} US/SAMPLE`,
    x0 + 4,
    cy + SEC_H + 8,
    INK.label,
    1,
  );
});

const outDir = join(root, "previews");
mkdirSync(outDir, { recursive: true });
const file = join(
  outDir,
  `${args.out ?? (args.craft === "skiff" ? "wash" : `wash-${args.craft}`)}.png`,
);
writeFileSync(file, canvas.toPng());

// ── The table ───────────────────────────────────────────────────────────
console.log(
  `the wash · ${args.craft} · λ ${WASH_WAVELENGTH.toFixed(2)} m · reach ${WASH_REACH.toFixed(1)} m`,
);
console.log("ride            km/h  planing  sources  crest cm  trough cm  reach m  µs/sample");
for (const r of rows) {
  console.log(
    `${r.label.padEnd(15)} ${(r.speed * 3.6).toFixed(0).padStart(4)}  ${r.planing.toFixed(2).padStart(7)}  ${String(r.sources).padStart(7)}  ${(r.plan.hi * 100).toFixed(1).padStart(8)}  ${(-r.plan.lo * 100).toFixed(1).padStart(9)}  ${r.reach.toFixed(0).padStart(7)}  ${r.plan.micros.toFixed(2).padStart(9)}`,
  );
}
console.log(`\nwrote ${file}`);
