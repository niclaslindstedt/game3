#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BLENDER LAB — a game asset MODELLED in Blender off the game's own
// data: `previews/blender/<id>-*.png` (studio renders), `<id>-lod{0,1,2}.glb`
// (the game budget) and the `.blend` files to open by hand. `make models`
// publishes the game-quality LOD0s into the committed `pwa/models/`, which
// every build draws (`pwa/src/game/craft-models.ts`).
//
// It never restates the game: it hands Blender the SAME numbers the game's
// builder reads, as one JSON file, and a builder under `scripts/blender/`
// models the asset from them in the data's own frame. A modelled craft, so,
// stands on the lines `craft-body.ts` lofts from the physics' own station
// tables to the millimetre, and a modelled rider is lofted through the very
// pieces `rider.ts` emits (`figureParts`), each on the bone it rides. Every
// output lands in the gitignored `previews/`. The `blender-assets` skill
// owns the loop, and says how a new KIND is added: a row in `KINDS` and a
// builder beside `craft.py`.
//
//   node scripts/blender.mjs                                the skiff, both qualities
//   node scripts/blender.mjs --id=dart --quality=game
//   node scripts/blender.mjs --id=all --quality=game   every craft, one after another
//   node scripts/blender.mjs --kind=rider --quality=render --views=three,side --samples=24
//   node scripts/blender.mjs --kind=tree --id=birch --quality=render --views=row --samples=16
//   node scripts/blender.mjs --kind=tree --id=all --quality=game --views=none   every tree kind
//   node scripts/blender.mjs --kind=undergrowth --id=heather --quality=render --views=row
//   node scripts/blender.mjs --kind=rock --id=all --quality=game --views=none
//   node scripts/blender.mjs --kind=mark --id=buoy --quality=render --views=three,chase
//   node scripts/blender.mjs --kind=bird --id=gull --quality=render --views=three,detail
//   node scripts/blender.mjs --kind=fauna --id=orca --quality=render --views=three,side
//
// Blender is looked for at `BLENDER`, then the macOS app, then `blender` on
// the PATH. It is run with `--python-use-system-env` and
// `PYTHONDONTWRITEBYTECODE=1`: an app copied without its files' times has
// stale bytecode, and on macOS the rewrite inside the signed bundle blocks
// Python's start for ever.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const QUALITIES = ["render", "game"];

/** THE KINDS OF ASSET: what the game's data for one is, and its builder.
 * The data is the game's own (`pwa/src/game/model-data.ts` — the same
 * functions the committed models' stamp is taken over), never restated. */
const data = () => import("../pwa/src/game/model-data.ts");
const KINDS = {
  // A craft: the spec, its style, the lines `craft-body.ts` lofts it on,
  // where it floats and the travel the game turns its bars and gate through.
  craft: {
    ids: async () => (await data()).MODELLED_CRAFTS,
    data: async (id) => (await data()).craftModelData(id),
    builder: "craft.py",
    fallback: "skiff",
  },
  // THE rider — one, in the kit every craft's rider wears: his pieces in
  // the pose he is bound in, every bone's frame there, his paint, and every
  // clip sampled off the game's own `poseRider`.
  rider: {
    ids: async () => ["rider"],
    data: async () => (await data()).riderModelData(),
    builder: "rider.py",
    fallback: "rider",
  },
  // A KIND of tree — every tree-form row of the cover roster: its six
  // variants (`tree-variants.ts`) with each one's silhouette sampled off
  // `crownAt`, the proportions the code's builder draws its form with, the
  // height a model is made at — and, for the stills alone, its own colours
  // in linear light. The game dresses a model by its materials' names, so
  // the glTF carries none.
  tree: {
    ids: async () => (await data()).MODELLED_TREES,
    data: async (id) => {
      const d = await data();
      return { ...d.treeModelData(id), paint: d.plantStillPaint(id) };
    },
    builder: "tree.py",
    fallback: "pine",
  },
  // A KIND of undergrowth — every bush, tuft, reed and stone row of the
  // roster: its four variants (`undergrowth-variants.ts`), the proportions
  // the code's builder draws its form with, the same reference height as a
  // tree's, and its colours for the stills alone.
  undergrowth: {
    ids: async () => (await data()).MODELLED_UNDERGROWTH,
    data: async (id) => {
      const d = await data();
      return { ...d.undergrowthModelData(id), paint: d.plantStillPaint(id) };
    },
    builder: "undergrowth.py",
    fallback: "heather",
  },
  // A KIND of instanced rock — the boulder, the erratic, the reef: the
  // code's proportions and four variants (`rock-variants.ts`), a unit lump
  // each; no colour, as the coast tints every instance.
  rock: {
    ids: async () => (await data()).MODELLED_ROCKS,
    data: async (id) => (await data()).rockModelData(id),
    builder: "rock.py",
    fallback: "boulder",
  },
  // A MARK of the course — the gate mark or the rounding buoy: the
  // profiles and dimensions the code lathes it from (`mark-shapes.ts`).
  mark: {
    ids: async () => (await data()).MODELLED_MARKS,
    data: async (id) => (await data()).markModelData(id),
    builder: "mark.py",
    fallback: "gatemark",
  },
  // A SPECIES of bird: its row's proportions and the wing's numbers
  // (`bird-wing.ts`), in the frame the shader flaps; its colours for the
  // stills alone.
  bird: {
    ids: async () => (await data()).MODELLED_BIRDS,
    data: async (id) => {
      const d = await data();
      return { ...d.birdModelData(id), paint: d.birdStillPaint(id) };
    },
    builder: "bird.py",
    fallback: "gull",
  },
  // A SPECIES of sea life: its catalog row, its style's proportions and
  // the body the code lofts (`fauna-body.ts`); its colours for the stills
  // alone.
  fauna: {
    ids: async () => (await data()).MODELLED_FAUNA,
    data: async (id) => {
      const d = await data();
      return { ...d.faunaModelData(id), paint: d.faunaStillPaint(id) };
    },
    builder: "fauna.py",
    fallback: "porpoise",
  },
};

const args = parseArgs(
  process.argv.slice(2),
  {
    kind: {
      kind: "string",
      default: "craft",
      help: `the kind of asset (${Object.keys(KINDS).join(", ")})`,
    },
    id: {
      kind: "string",
      default: "",
      help: "which one (a craft's id, a tree's, an undergrowth's, a rock's or a mark's kind, a bird's or an animal's id), or all; the kind's default (skiff, pine, heather, boulder, gatemark, gull, porpoise) when left out",
    },
    quality: {
      kind: "string",
      default: "both",
      help: "render (studio stills, subdivided), game (the triangle budget and its LODs), or both",
    },
    views: {
      kind: "string",
      default: "",
      help: "only these cameras (side,three,rear3,chase,detail; a plant's row,far,close), or none; every one when left out",
    },
    samples: { kind: "number", default: 64, help: "Cycles samples a still" },
    out: { kind: "string", default: "previews/blender", help: "where everything is written" },
  },
  "usage: node scripts/blender.mjs [--kind=craft] [--id=skiff] [--quality=render|game|both] [--views=a,b] [--samples=n]",
);

const kind = KINDS[args.kind];
if (!kind) {
  console.error(`unknown kind "${args.kind}" (${Object.keys(KINDS).join(", ")})`);
  process.exit(2);
}
const qualities = args.quality === "both" ? QUALITIES : [args.quality];
if (!qualities.every((q) => QUALITIES.includes(q))) {
  console.error(`unknown quality "${args.quality}" (render, game, both)`);
  process.exit(2);
}

aliasEngine(root);
const ids = await kind.ids();
const wanted = args.id === "all" ? ids : [args.id || kind.fallback];
const unknown = wanted.find((id) => !ids.includes(id));
if (unknown) {
  console.error(`unknown ${args.kind} "${unknown}" (${ids.join(", ")}, all)`);
  process.exit(2);
}

const outDir = join(root, args.out);
mkdirSync(outDir, { recursive: true });

const blender =
  [process.env.BLENDER, "/Applications/Blender.app/Contents/MacOS/Blender"].find(
    (c) => c && existsSync(c),
  ) ?? "blender";

for (const id of wanted) {
  const data = join(outDir, `${id}.json`);
  writeFileSync(data, JSON.stringify(await kind.data(id), null, 2));
  for (const quality of qualities) await model(id, data, quality);
}

/** One builder pass over one asset at one quality; a Python error ends the run. */
async function model(id, data, quality) {
  const t0 = Date.now();
  const code = await new Promise((done) => {
    const child = spawn(
      blender,
      [
        "-b",
        "--factory-startup",
        "--python-use-system-env",
        "--python-exit-code",
        "1",
        "-P",
        join(root, "scripts", "blender", kind.builder),
        "--",
        data,
        outDir,
        String(args.samples),
      ],
      {
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1", QUALITY: quality, VIEWS: args.views },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    child.on("error", (err) => {
      console.error(`no Blender (${err.message}): install it, or point BLENDER at its executable`);
      done(1);
    });
    // Blender is loud; what is worth a line is what the builder prints,
    // what was saved, and anything that went wrong.
    // A line can straddle two chunks, so each stream keeps its unfinished
    // tail until the rest arrives.
    const tails = new Map();
    const echo = (buf, from) => {
      const lines = ((tails.get(from) ?? "") + buf.toString()).split("\n");
      tails.set(from, lines.pop());
      for (const line of lines) {
        if (/^(BONES|CLIPS|TRIANGLES)|Saved: '|Error|Traceback|File "/.test(line)) {
          console.log(line.replace(/^.*Saved: '(.*)'.*$/, "saved $1").replace(`${root}/`, ""));
        }
      }
    };
    child.stdout.on("data", (b) => echo(b, "out"));
    child.stderr.on("data", (b) => echo(b, "err"));
    child.on("close", (code) => {
      for (const from of ["out", "err"]) echo("\n", from);
      done(code);
    });
  });
  if (code !== 0) {
    console.error(`blender exited ${code} on the ${quality} pass`);
    process.exit(1);
  }
  console.log(`${args.kind} ${id} · ${quality}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
