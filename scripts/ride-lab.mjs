#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDE LAB — the craft on the water, in sequence, drawn as a diagram.
//
// `make sim` counts launches and dives and `make screenshots` shows one
// frame of one; neither can answer the question a hull raises, which is
// what it was DOING at each moment — how it sat, when it came onto the
// plane, at what angle it left the lip, how deep the bow went on the way
// down. So this stages one scenario (`lib/ride-scenarios.mjs`) with
// `placeRun`, rides it with a scripted input through the real engine at
// 120 Hz, isolated from everything that is not the physics (no renderer,
// no browser, no assets — the engine and a PNG canvas), and draws it the
// way a towing tank plots a run: the PROFILE, the PLAN where it turns, and
// every sixth of a second as its own cell with the numbers that decide the
// next step printed beside it.
//
//   make ride SCENARIO=launch                 one scenario
//   make ride SCENARIO=chop CRAFT=otter SEED=7
//   node scripts/ride-lab.mjs --all           every scenario
//   node scripts/ride-lab.mjs launch --every 0.1 --seconds 4
//
// Writes previews/ride-<scenario>[-<craft>].png and prints the frame
// table, which is the half that survives being pasted into a PR. Required
// before and after any change to the hull, the planing lift, the slamming
// or the flight — and the point of it is that a physics change can be
// LOOKED at without a browser: a craft that sinks, porpoises, launches at
// a silly angle or dives on every landing is a finding, in the picture.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "./lib/cli.mjs";
import { createDrawing } from "./lib/draw.mjs";
import { INK, drawFrames, drawPlan, drawProfile, eventTag } from "./lib/ride-draw.mjs";
import { SCENARIOS, SCENARIO_IDS } from "./lib/ride-scenarios.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const {
  createGame,
  generateLevel,
  placeRun,
  step,
  heightAt,
  sampleField,
  craftById,
  CRAFT_IDS,
  TUNING,
  engineVersion,
} = await import(join(root, "engine/index.ts"));

const args = parseArgs(
  process.argv.slice(2),
  {
    scenario: { kind: "string", help: `which (${SCENARIO_IDS.join(", ")}); a bare word works too` },
    all: { kind: "flag", help: "every scenario, one picture each" },
    craft: { kind: "string", default: "skiff", help: "craft id" },
    seed: { kind: "number", default: 38, help: "the level the scenario is staged on" },
    seconds: { kind: "number", help: "how long to ride (the scenario's own when left out)" },
    every: { kind: "number", default: 1 / 6, help: "seconds between drawn frames" },
    wind: { kind: "number", help: "override the wind speed, m/s (the level's own quarter)" },
    hs: {
      kind: "number",
      help: "quote the sea by its significant height, m, instead of the wind's",
    },
    assist: {
      kind: "number",
      help: "the arcade landing assist, 0..1 (the tuning's default when left out); 0 is the bare physics",
    },
  },
  "usage: npm run ride -- [--scenario name | name | --all] [--craft id] [--seed n] [--seconds s] [--every s] [--wind m/s] [--hs m] [--assist 0..1]",
);
if (!CRAFT_IDS.includes(args.craft)) {
  console.error(`unknown craft "${args.craft}" (${CRAFT_IDS.join(", ")})`);
  process.exit(2);
}
const wanted = args.all ? SCENARIO_IDS : [args.scenario ?? args._[0] ?? "cruise"];
for (const id of wanted) {
  if (!SCENARIOS[id]) {
    console.error(`unknown scenario "${id}" (${SCENARIO_IDS.join(", ")})`);
    process.exit(2);
  }
}

const outDir = join(root, "previews");
mkdirSync(outDir, { recursive: true });
const level = generateLevel(args.seed);
const spec = craftById(args.craft);
const round = (v, n = 0) => v.toFixed(n);
const deg = (rad) => (rad * 180) / Math.PI;
const pad = (v, n) => String(v).padStart(n);

/** Ride one scenario and record every step in the release frame. */
function ride(id) {
  const scenario = SCENARIOS[id];
  const { moment, input } = scenario.stage(level, spec);
  const state = createGame({
    seed: args.seed,
    craft: args.craft,
    level,
    quiet: true,
    windSpeed: args.wind,
    sea: args.hs !== undefined ? { hs: args.hs } : undefined,
    assist: args.assist,
  });
  placeRun(state, moment);
  const x0 = state.craft.x;
  const z0 = state.craft.z;
  const h0 = moment.heading;
  const fx = Math.sin(h0);
  const fz = Math.cos(h0);
  const rx = Math.cos(h0);
  const rz = -Math.sin(h0);
  const seconds = args.seconds ?? scenario.seconds;
  const steps = Math.round(seconds / TUNING.dt);
  const frames = [];
  const record = (t, events, given) => {
    const c = state.craft;
    frames.push({
      t,
      x: c.x,
      z: c.z,
      y: c.y,
      along: (c.x - x0) * fx + (c.z - z0) * fz,
      across: (c.x - x0) * rx + (c.z - z0) * rz,
      vAlong: c.vx * fx + c.vz * fz,
      vAcross: c.vx * rx + c.vz * rz,
      vy: c.vy,
      speed: c.speed,
      heading: c.heading,
      pitch: c.pitch,
      roll: c.roll,
      wetted: c.wetted,
      planing: c.planing,
      rpm: c.rpm,
      throttleEff: c.throttleEff,
      lean: given.lean,
      airborne: c.airborne,
      airTime: c.airTime,
      onRamp: c.onRamp,
      submergedDepth: c.submergedDepth,
      water: heightAt(state.sea, level, c.x, c.z, state.t),
      ground: sampleField(level.ground, c.x, c.z),
      events,
    });
  };
  record(0, [], { lean: 0 });
  const t0 = state.t;
  for (let i = 1; i <= steps; i++) {
    const t = i * TUNING.dt;
    const given = input(t, state);
    step(state, given);
    record(state.t - t0, [...state.events], given);
  }
  // Ramps near the track, projected into the release frame.
  const ramps = [];
  for (const g of level.course.gates) {
    if (!g.ramp) continue;
    const r = g.ramp;
    const hingeAlong = (r.x - x0) * fx + (r.z - z0) * fz;
    const hingeAcross = (r.x - x0) * rx + (r.z - z0) * rz;
    const minAlong = Math.min(...frames.map((f) => f.along)) - 20;
    const maxAlong = Math.max(...frames.map((f) => f.along)) + 20;
    if (Math.abs(hingeAcross) > 12 || hingeAlong < minAlong || hingeAlong > maxAlong) continue;
    const lipAlong = hingeAlong + r.length * Math.cos(r.heading - h0);
    ramps.push({ id: r.id, hingeAlong, lipAlong, lipY: r.length * Math.tan(r.angle) });
  }
  return { id, scenario, moment, spec, heading0: h0, frames, ramps, seconds };
}

for (const id of wanted) {
  const run = ride(id);
  const everySteps = Math.max(1, Math.round(args.every / TUNING.dt));
  const shown = run.frames.filter((f, i) => i % everySteps === 0);
  const turns = run.scenario.plan || Math.max(...run.frames.map((f) => Math.abs(f.across))) > 3;

  // ── Say it ────────────────────────────────────────────────────────────
  const m = run.moment;
  console.log(
    `ride — engine ${engineVersion} · ${id}: ${run.scenario.blurb} · ${spec.name} on seed ${args.seed} · ` +
      `${run.seconds} s at ${TUNING.physicsHz} Hz, a frame every ${args.every.toFixed(3)} s`,
  );
  console.log(
    `stood at (${round(m.x)}, ${round(m.z)}) heading ${round(deg(m.heading))}°` +
      `${m.speed ? ` at ${round(m.speed * 3.6)} km/h` : ", at rest"}` +
      `${m.height ? `, ${round(m.height, 1)} m up, vy ${round(m.vy ?? 0, 1)}, pitch ${round(deg(m.pitch ?? 0))}°` : ""}` +
      `${run.ramps.length ? ` · ramps in frame: ${run.ramps.map((r) => r.id).join(", ")}` : ""}`,
  );
  console.log(
    [
      pad("#", 3),
      pad("t", 5),
      pad("along", 6),
      pad("acr", 5),
      pad("y", 5),
      pad("wave", 5),
      pad("km/h", 5),
      pad("pitch", 6),
      pad("roll", 5),
      pad("wet", 4),
      pad("plane", 5),
      pad("rpm", 5),
      pad("thr", 4),
      pad("lean", 5),
      pad("air", 5),
      pad("sub", 5),
      "  events",
    ].join(" "),
  );
  shown.forEach((f, i) => {
    console.log(
      [
        pad(i, 3),
        pad(round(f.t, 2), 5),
        pad(round(f.along, 1), 6),
        pad(round(f.across, 1), 5),
        pad(round(f.y, 2), 5),
        pad(round(f.water, 2), 5),
        pad(round(f.speed * 3.6), 5),
        pad(round(deg(f.pitch)) + "°", 6),
        pad(round(deg(f.roll)) + "°", 5),
        pad(round(f.wetted * 100) + "%", 4),
        pad(round(f.planing * 100) + "%", 5),
        pad(round(f.rpm), 5),
        pad(round(f.throttleEff * 100) + "%", 4),
        pad(round(f.lean, 1), 5),
        pad(f.airborne ? round(f.airTime, 2) : f.onRamp ? "ramp" : "-", 5),
        pad(round(f.submergedDepth, 2), 5),
        "  " + f.events.map((e) => e.kind).join(","),
      ].join(" "),
    );
  });
  // Every event on any step, not just the drawn ones.
  const all = run.frames.flatMap((f) => f.events.map((e) => `${e.kind}@${round(f.t, 2)}s`));
  if (all.length) console.log(`events: ${all.join("  ")}`);
  const last = run.frames[run.frames.length - 1];
  const maxAir = Math.max(...run.frames.map((f) => f.airTime));
  const minY = Math.min(...run.frames.map((f) => f.y - f.water));
  const maxPitch = Math.max(...run.frames.map((f) => f.pitch));
  const minPitch = Math.min(...run.frames.map((f) => f.pitch));
  console.log(
    `ended at ${round(last.speed * 3.6)} km/h, ${round(last.along, 1)} m along, ${round(last.across, 1)} m across, ` +
      `heading ${round(deg(last.heading))}° · longest flight ${round(maxAir, 2)} s · ` +
      `pitch ${round(deg(minPitch))}°…${round(deg(maxPitch))}° · lowest CoG ${round(minY, 2)} m under the surface line`,
  );

  // ── Draw it ───────────────────────────────────────────────────────────
  const W = 1400;
  const PAD = 24;
  const profile = { x: PAD, y: 44, w: W - PAD * 2, h: 240, pad: 20 };
  let y = profile.y + profile.h + 30;
  const plan = turns ? { x: PAD, y, w: W - PAD * 2, h: 200, pad: 16 } : null;
  if (plan) y += plan.h + 30;
  const cols = Math.floor((W - PAD * 2) / 196);
  const rowsNeeded = Math.ceil(shown.length / cols) * 118;
  const canvas = createDrawing(W, y + rowsNeeded + 24, INK.paper);
  canvas.fillRect(profile.x, profile.y, profile.w, profile.h, INK.panel);
  canvas.text(
    `RIDE  ${id.toUpperCase()}  ${spec.name.toUpperCase()}  SEED ${args.seed}  ${run.seconds}S`,
    PAD,
    10,
    INK.label,
    2,
  );
  canvas.text(run.scenario.blurb.toUpperCase(), PAD + 8, 30, INK.dim, 1);
  drawProfile(canvas, run, profile, shown);
  if (plan) {
    canvas.fillRect(plan.x, plan.y, plan.w, plan.h, INK.panel);
    drawPlan(canvas, run, plan, shown);
  }
  drawFrames(canvas, run, { x: PAD, y, w: W - PAD * 2 }, shown);
  const tags = shown.map((f) => eventTag(f.events)).filter(Boolean);
  const name = `ride-${id}${args.craft === "skiff" ? "" : `-${args.craft}`}`;
  const file = join(outDir, `${name}.png`);
  writeFileSync(file, canvas.toPng());
  console.log(`wrote ${file}${tags.length ? ` (${tags.join(", ")})` : ""}\n`);
}
