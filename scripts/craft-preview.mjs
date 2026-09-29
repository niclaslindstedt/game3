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
// THE ASSET SHEET: `--asset=previews/blender/skiff-lod0.glb,…` sets a
// craft MODELLED in Blender (`make blender`, the `blender-assets` skill)
// below the builder's own, each through the very code the game draws it
// with (`craft-models.ts`: merged, dressed, hung, the code's hull
// collapsed), with the game's rider on it — or the modelled one, with
// `--rider=previews/blender/rider-lod0.glb` — and `--steer` turns the bars
// and the nozzle to a share of their lock, the rider's hands with them.
//   make crafts ARGS="--asset=previews/blender/skiff-lod0.glb,previews/blender/skiff-lod1.glb"
//
// Beside the picture it prints the numbers a proportion is argued about:
// the draft, the freeboard, the bars and the rider's helmet over the
// waterline, and the triangle counts — the render budget a craft spends.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { createDrawing } from "@niclaslindstedt/oss-game-framework/tooling/draw";
import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
aliasEngine(root);
const { CRAFT, CRAFT_IDS, craftById, hullProbes, restY } = await import(
  join(root, "engine/index.ts")
);
const { buildCraft, cockpitOf } = await import(join(root, "pwa/src/game/craft-body.ts"));
const { createRider } = await import(join(root, "pwa/src/game/rider.ts"));
const { REST_READ, poseRider } = await import(join(root, "pwa/src/game/rider-pose.ts"));
const { CRAFT_STYLES } = await import(join(root, "pwa/src/game/craft-styles.ts"));
const { biomeOf } = await import(join(root, "engine/mapgen/biomes.ts"));
const models = await import(join(root, "pwa/src/game/craft-models.ts"));
const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
const THREE = await import("three");

const args = parseArgs(
  process.argv.slice(2),
  {
    craft: { kind: "string", help: `one craft (${CRAFT_IDS.join(", ")}); every one when left out` },
    scale: { kind: "number", default: 90, help: "pixels per metre" },
    out: { kind: "string", help: "where to write the PNG (previews/crafts[-<craft>].png)" },
    asset: {
      kind: "string",
      default: "",
      help: "modelled crafts to set below the builder's (glTF paths, comma-separated; the id is the file's stem before its first -)",
    },
    rider: { kind: "string", default: "", help: "a modelled rider (glTF) to seat on the models" },
    steer: {
      kind: "number",
      default: 0,
      help: "the bars turned to this share of their lock, -1..1",
    },
  },
  "usage: node scripts/craft-preview.mjs [--craft id] [--scale px] [--asset=a.glb,b.glb] [--rider=r.glb] [--steer s]",
);

/** A glTF off the disk, parsed as the game parses one. */
async function readGltf(path) {
  const buf = readFileSync(join(root, path));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((done, fail) => new GLTFLoader().parse(ab, "", done, fail));
}
const assets = await Promise.all(
  args.asset
    .split(",")
    .filter(Boolean)
    .map(async (path) => ({ path, id: basename(path).split("-")[0], gltf: await readGltf(path) })),
);
const riderGltf = args.rider ? await readGltf(args.rider) : null;
for (const a of assets) {
  if (!CRAFT_IDS.includes(a.id)) {
    console.error(`${a.path}: no craft "${a.id}" (${CRAFT_IDS.join(", ")})`);
    process.exit(2);
  }
}

/** The rows: every craft asked for as the builder draws it — and, with
 * `--asset`, each asset's craft as the builder draws it, then the models. */
const rowsOf = assets.length
  ? [...new Set(assets.map((a) => a.id))].flatMap((id) => [
      { spec: craftById(id), label: craftById(id).name, asset: null },
      ...assets
        .filter((a) => a.id === id)
        .map((a) => ({ spec: craftById(id), label: basename(a.path, ".glb"), asset: a })),
    ])
  : (args.craft ? [craftById(args.craft)] : CRAFT).map((spec) => ({
      spec,
      label: spec.name,
      asset: null,
    }));
const specs = rowsOf.map((r) => r.spec);
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

/** Every triangle drawn under `root`, in its frame: the builder's merged
 * meshes and a model's skinned one alike (its vertices through its bones),
 * a mesh whose draw is collapsed (`craft-models.ts`) left out. */
function drawnTriangles(root) {
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const out = [];
  const v = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh || o.geometry.drawRange.count === 0) return;
    const g = o.geometry;
    const col = g.getAttribute("color");
    const m = new THREE.Matrix4().multiplyMatrices(toRoot, o.matrixWorld);
    const n = g.index ? g.index.count : g.getAttribute("position").count;
    const at = (i) => {
      const k = g.index ? g.index.getX(i) : i;
      if (o.isSkinnedMesh) o.getVertexPosition(k, v);
      else v.fromBufferAttribute(g.getAttribute("position"), k);
      v.applyMatrix4(m);
      return { p: [v.x, v.y, v.z], c: col ? [col.getX(k), col.getY(k), col.getZ(k)] : [1, 0, 1] };
    };
    for (let i = 0; i + 2 < n; i += 3) {
      const [a, b, c] = [at(i), at(i + 1), at(i + 2)];
      out.push({ a: a.p, b: b.p, c: c.p, color: a.c });
    }
  });
  return out;
}

/** A craft's state with the bars and the nozzle at `share` of their lock. */
function steered(spec, share) {
  return { spec, nozzle: share * spec.nozzleAngle, trim: 0, bucket: 0 };
}

/** The craft the builder made — or, with a model adopted, the craft the game
 * draws — and the rider sat on it at rest, hands on the bars as they turn. */
function triangles(spec, style, asset) {
  models.adoptModels({
    crafts: asset ? new Map([[spec.id, asset.gltf]]) : new Map(),
    rider: asset ? riderGltf : null,
  });
  const group = buildCraft(spec, style);
  models.hangCraft(group, spec, group.children[0].material);
  const craftState = steered(spec, asset ? args.steer : 0);
  models.poseCraft(group, craftState);
  const craft = drawnTriangles(group);
  const rider = createRider(cockpitOf(spec, style));
  rider.pose(models.onTheBars(poseRider(cockpitOf(spec, style), REST_READ), craftState));
  group.add(rider.mesh);
  return { craft, rider: drawnTriangles(rider.mesh) };
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
rowsOf.forEach(({ spec, label, asset }, row) => {
  const style = CRAFT_STYLES[spec.id];
  const { craft, rider } = triangles(spec, style, asset);
  const tris = [...craft, ...rider];
  const float = restY(spec, density);
  const top = 22 + row * cellH;
  canvas.line(0, top, width, top, INK.grid);
  canvas.text(label.toUpperCase(), 10, top + 10, INK.label, asset ? 1 : 2);
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
    craft: asset ? basename(asset.path, ".glb") : spec.id,
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
  args.out ??
  join(
    root,
    "previews",
    assets.length
      ? `crafts-asset-${[...new Set(assets.map((a) => a.id))].join("-")}.png`
      : args.craft
        ? `crafts-${args.craft}.png`
        : "crafts.png",
  );
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
