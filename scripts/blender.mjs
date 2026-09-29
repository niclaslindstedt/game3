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
      help: "which one (a craft's id), or all; the kind's default (skiff) when left out",
    },
    quality: {
      kind: "string",
      default: "both",
      help: "render (studio stills, subdivided), game (the triangle budget and its LODs), or both",
    },
    views: {
      kind: "string",
      default: "",
      help: "only these cameras (side,three,rear3,chase,detail), or none; every one when left out",
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
