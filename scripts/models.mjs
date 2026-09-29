#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELS THE GAME SHIPS, published: the last step of `make models`
// (which first runs `make blender`'s game quality for every craft, the rider
// and every kind of tree). Copies each craft's and the rider's LOD0 glTF out
// of the gitignored `previews/blender/` into the committed `pwa/models/`
// under the name the build packs it by (`<id>.glb`, `rider.glb`), PACKS
// every kind of tree's (`scripts/lib/glb-pack.mjs`: quantized and
// meshopt-compressed) into `pwa/models/trees/<kind>.glb`, and writes
// `pwa/models/sources.json` — the hash of everything each half is made from
// (`modelStamp` and `treeStamp` in `pwa/models-stamp.ts`), which
// `tests/models_test.ts` holds to the tree. A half not published keeps its
// stamp: it was not remade.
//
//   node scripts/models.mjs                  publish what `make blender` made
//   node scripts/models.mjs --set=trees      the trees only (machines: the crafts and the rider)
//   node scripts/models.mjs --check          only say whether the stamps are fresh

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";

import { packGlb } from "./lib/glb-pack.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
aliasEngine(root);
const { MODELS_DIR, modelFiles } = await import("../pwa/models-plugin.ts");
const { modelStamp, treeStamp } = await import("../pwa/models-stamp.ts");

const args = parseArgs(
  process.argv.slice(2),
  {
    check: { kind: "flag", help: "only report whether pwa/models/ is fresh against its sources" },
    set: {
      kind: "string",
      default: "all",
      help: "which half to publish: machines (the crafts and the rider), trees, or all",
    },
    from: {
      kind: "string",
      default: "previews/blender",
      help: "where make blender left the glTFs",
    },
  },
  "usage: node scripts/models.mjs [--check] [--set=all|machines|trees] [--from=previews/blender]",
);
if (!["all", "machines", "trees"].includes(args.set)) {
  console.error(`unknown set "${args.set}" (all, machines, trees)`);
  process.exit(2);
}

const out = join(root, MODELS_DIR);
const stampAt = join(out, "sources.json");
const stamps = { sources: modelStamp(root), trees: treeStamp(root) };
const had = existsSync(stampAt) ? JSON.parse(readFileSync(stampAt, "utf8")) : {};

if (args.check) {
  const stale = Object.keys(stamps).filter((k) => had[k] !== stamps[k]);
  console.log(
    stale.length === 0
      ? "pwa/models/ is fresh"
      : `pwa/models/ is STALE (${stale.join(", ")}) — run \`make models\``,
  );
  process.exit(stale.length === 0 ? 0 : 1);
}

const machines = args.set !== "trees";
const trees = args.set !== "machines";
/** Each published name and the file `make blender` wrote it as. */
const made = (name) =>
  join(
    root,
    args.from,
    name.startsWith("trees/") ? name.slice("trees/".length) : name.replace(".glb", "-lod0.glb"),
  );
const names = modelFiles({ crafts: machines, riders: machines, trees });
const missing = names.filter((n) => !existsSync(made(n)));
if (missing.length) {
  console.error(
    `not made: ${missing.map(made).join(", ")} — run make blender's game quality first`,
  );
  process.exit(1);
}
mkdirSync(join(out, "trees"), { recursive: true });
for (const n of names) {
  if (n.startsWith("trees/")) {
    writeFileSync(join(out, n), await packGlb(readFileSync(made(n))));
  } else {
    copyFileSync(made(n), join(out, n));
  }
  console.log(
    `${MODELS_DIR}/${n}  ${(readFileSync(join(out, n)).byteLength / 1024).toFixed(0)} KiB`,
  );
}
const stamp = {
  sources: machines ? stamps.sources : had.sources,
  trees: trees ? stamps.trees : had.trees,
  blender: "5.2.2",
};
writeFileSync(stampAt, `${JSON.stringify(stamp, null, 2)}\n`);
console.log(
  `${MODELS_DIR}/sources.json  ${stamp.sources?.slice(0, 12)} · trees ${stamp.trees?.slice(0, 12)}`,
);
