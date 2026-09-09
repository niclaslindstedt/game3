#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CRAFT SHEET — every craft, from the builder the app draws with, in
// elevation: side, bow, stern, plan and the chase view's three-quarter,
// with the rider on the saddle and the physics laid over the picture —
// the waterline the hull floats at on the level's water and every buoyancy
// probe as a dot. A chase-camera
// screenshot judges a craft at sixty pixels tall from one angle and needs a
// build and a browser first; this is the contact sheet for the sculpture
// itself, in a second, pure Node: `craft-body.ts` is imported through the
// `@engine` alias (and rider.ts, stood on it at rest through the same
// `cockpitOf` the app uses) and their triangles are painted here, so what
// is on the sheet is exactly what the renderer would draw.
//
//   make crafts                     every craft, previews/crafts.png
//   make crafts CRAFT=marlin        one craft, previews/crafts-marlin.png
//   node scripts/craft-preview.mjs --scale 120
//
// Beside the picture it prints the numbers a proportion is argued about:
// the draft, the freeboard, the bars and the rider's helmet over the
// waterline, and the triangle counts — the render budget a craft spends.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "./lib/cli.mjs";
import { createDrawing } from "./lib/draw.mjs";
import { aliasEngine } from "./lib/engine-alias.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
aliasEngine(root);
const { CRAFT, CRAFT_IDS, craftById, hullProbes, restY } = await import(
  join(root, "engine/index.ts")
);
const { buildCraft, cockpitOf } = await import(join(root, "pwa/src/game/craft-body.ts"));
const { createRider } = await import(join(root, "pwa/src/game/rider.ts"));
const { CRAFT_STYLES } = await import(join(root, "pwa/src/game/craft-styles.ts"));
const { biomeOf } = await import(join(root, "engine/mapgen/biomes.ts"));

const args = parseArgs(
  process.argv.slice(2),
  {
    craft: { kind: "string", help: `one craft (${CRAFT_IDS.join(", ")}); every one when left out` },
    scale: { kind: "number", default: 90, help: "pixels per metre" },
    out: { kind: "string", help: "where to write the PNG (previews/crafts[-<craft>].png)" },
  },
  "usage: node scripts/craft-preview.mjs [--craft id] [--scale px]",
);

const specs = args.craft ? [craftById(args.craft)] : CRAFT;
const density = biomeOf("taiga").water.density;

/** A view: where the eye stands, as a unit direction FROM the craft, and
 * which way is up on the page. `right` and `up` follow from the look
 * direction the way a camera's do. */
const VIEWS = [
  { name: "side", eye: [-1, 0, 0], up: [0, 1, 0], width: 1.15, height: 0.62 },
  { name: "bow", eye: [0, 0, 1], up: [0, 1, 0], width: 0.42, height: 0.62 },
  { name: "stern", eye: [0, 0, -1], up: [0, 1, 0], width: 0.42, height: 0.62 },
  { name: "plan", eye: [0, 1, 0], up: [1, 0, 0], width: 1.15, height: 0.42 },
  { name: "chase", eye: [-0.55, 0.5, -0.75], up: [0, 1, 0], width: 0.95, height: 0.7 },
];
/** A cell is the longest craft's footprint times these, so every craft is
 * drawn to the same scale and a longer hull reads longer. */
const LONGEST = Math.max(...CRAFT.map((c) => c.length));
const TALLEST = Math.max(...CRAFT.map((c) => c.height)) + 1.9;

const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/** The camera basis for a view: look along `-eye`, `right = look × up`. */
function basis(view) {
  const look = norm(view.eye.map((v) => -v));
  const right = norm(cross(look, view.up));
  const up = cross(right, look);
  return { look, right, up };
}

/** The triangles of a mesh, body frame, with their vertex colour. */
function trianglesOf(mesh) {
  const out = [];
  const pos = mesh.geometry.getAttribute("position").array;
  const col = mesh.geometry.getAttribute("color").array;
  for (let i = 0; i + 8 < pos.length; i += 9) {
    const a = [pos[i], pos[i + 1], pos[i + 2]];
    const b = [pos[i + 3], pos[i + 4], pos[i + 5]];
    const c = [pos[i + 6], pos[i + 7], pos[i + 8]];
    out.push({ a, b, c, color: [col[i], col[i + 1], col[i + 2]] });
  }
  return out;
}

/** The craft the builder made and the rider sat on it at rest. */
function triangles(spec, style) {
  const craft = buildCraft(spec, style).children.flatMap(trianglesOf);
  const rider = trianglesOf(createRider(cockpitOf(spec, style)).mesh);
  return { craft, rider };
}

/** A sun over the viewer's shoulder, so every view shades the same way. */
const SUN = norm([0.35, 1, -0.3]);

/** Paint the triangles into a cell: painter's order along the look, the
 * faces turned away culled, each lit by its own normal — the flat shading
 * the app's material gives them. `origin` is where the CoG lands on the
 * page, `scale` in pixels per metre. */
function paintCraft(canvas, tris, view, origin, scale) {
  const { look, right, up } = basis(view);
  const page = (p) => [origin[0] + dot(p, right) * scale, origin[1] - dot(p, up) * scale];
  const sorted = tris
    .map((t) => {
      const n = norm(cross(sub(t.b, t.a), sub(t.c, t.a)));
      const depth = (dot(t.a, look) + dot(t.b, look) + dot(t.c, look)) / 3;
      return { ...t, n, depth };
    })
    .filter((t) => dot(t.n, look) < 0)
    .sort((p, q) => q.depth - p.depth);
  for (const t of sorted) {
    const lit = 0.45 + 0.55 * Math.max(0, dot(t.n, SUN));
    const color = t.color.map((c) => Math.round(Math.min(1, Math.sqrt(c) * lit) * 255));
    canvas.poly([page(t.a), page(t.b), page(t.c)], color);
  }
  return page;
}

const INK = {
  bg: [246, 247, 248],
  grid: [214, 220, 224],
  label: [70, 78, 84],
  water: [27, 111, 138, 140],
  probe: [242, 140, 40],
};

const scale = args.scale;
const cellW = VIEWS.map((v) => Math.round(v.width * LONGEST * scale) + 24);
const cellH = Math.round(TALLEST * scale) + 34;
const labelW = 130;
const width = labelW + cellW.reduce((a, b) => a + b, 0);
const height = 22 + specs.length * cellH;
const canvas = createDrawing(width, height, INK.bg);

let x = labelW;
VIEWS.forEach((v, i) => {
  canvas.text(v.name, x + 8, 7, INK.label, 1);
  x += cellW[i];
});

const rows = [];
specs.forEach((spec, row) => {
  const style = CRAFT_STYLES[spec.id];
  const { craft, rider } = triangles(spec, style);
  const tris = [...craft, ...rider];
  const float = restY(spec, density);
  const top = 22 + row * cellH;
  canvas.line(0, top, width, top, INK.grid);
  canvas.text(spec.name, 10, top + 10, INK.label, 2);
  canvas.text(`${spec.length.toFixed(2)} X ${spec.beam.toFixed(2)} M`, 10, top + 32, INK.label, 1);
  canvas.text(`${craft.length} + ${rider.length} TRIS`, 10, top + 44, INK.label, 1);

  let cx = labelW;
  VIEWS.forEach((view, i) => {
    // The CoG sits in the cell so the keel clears the bottom and the bars
    // the top: under the middle for an elevation, centred for the plan.
    const origin = [cx + cellW[i] / 2, top + (view.name === "plan" ? cellH / 2 : cellH * 0.58)];
    const page = paintCraft(canvas, tris, view, origin, scale);
    if (view.up[1] === 1 && view.eye[1] === 0) {
      // The rest waterline: the hull floats with its CoG `float` over the
      // surface, so the water crosses the body frame at -float.
      const y = origin[1] + float * scale;
      canvas.line(cx + 6, y, cx + cellW[i] - 6, y, INK.water, 2);
    }
    if (view.name === "side" || view.name === "plan") {
      for (const p of hullProbes(spec)) {
        const [px, py] = page([p.x, p.y, p.z]);
        canvas.disk(px, py, p.kind === "deck" ? 1.5 : 2.5, INK.probe);
      }
    }
    cx += cellW[i];
  });

  // What the picture is argued about, off the geometry itself.
  let keel = Infinity;
  let bars = -Infinity;
  let beamDrawn = 0;
  for (const t of craft) {
    for (const p of [t.a, t.b, t.c]) {
      if (p[1] < keel) keel = p[1];
      if (p[1] > bars) bars = p[1];
      if (Math.abs(p[0]) > beamDrawn) beamDrawn = Math.abs(p[0]);
    }
  }
  let helmet = -Infinity;
  for (const t of rider) {
    for (const p of [t.a, t.b, t.c]) if (p[1] > helmet) helmet = p[1];
  }
  rows.push({
    craft: spec.id,
    tris: craft.length,
    riderTris: rider.length,
    draft: (-keel - float).toFixed(2),
    freeboard: (spec.height - spec.cog.y + float).toFixed(2),
    bars: (bars + float).toFixed(2),
    helmet: (helmet + float).toFixed(2),
    beam: (2 * beamDrawn).toFixed(2),
  });
});

mkdirSync(join(root, "previews"), { recursive: true });
const out =
  args.out ?? join(root, "previews", args.craft ? `crafts-${args.craft}.png` : "crafts.png");
writeFileSync(out, canvas.toPng());

console.log(
  `crafts — ${specs.map((s) => s.id).join(", ")} at ${scale} px/m, water ${density} kg/m³`,
);
console.log(
  "  craft      tris  rider   draft  freeboard  bars  helmet   beam   (m, over the rest waterline; beam as drawn, sponsons in)",
);
for (const r of rows) {
  console.log(
    `  ${r.craft.padEnd(8)} ${String(r.tris).padStart(6)} ${String(r.riderTris).padStart(6)}   ${r.draft}   ${r.freeboard.padStart(6)}    ${r.bars}   ${r.helmet}   ${r.beam}`,
  );
}
console.log(`  → ${out.replace(root + "/", "")}`);
