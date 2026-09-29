#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELS THE GAME SHIPS, published: the last step of `make models`
// (which first runs `make blender`'s game quality for every craft and the
// rider). Copies each LOD0 glTF out of the gitignored `previews/blender/`
// into the committed `pwa/models/` under the name the build packs it by
// (`<id>.glb`, `rider.glb`), and writes `pwa/models/sources.json` — the
// hash of everything the models are made from (`pwa/models-stamp.ts`),
// which `tests/models_test.ts` holds to the tree.
//
//   node scripts/models.mjs            publish what `make blender` made
//   node scripts/models.mjs --check    only say whether the stamp is fresh

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
aliasEngine(root);
const { MODELS_DIR, modelFiles } = await import("../pwa/models-plugin.ts");
const { modelStamp } = await import("../pwa/models-stamp.ts");

const args = parseArgs(
  process.argv.slice(2),
  {
    check: { kind: "flag", help: "only report whether pwa/models/ is fresh against its sources" },
    from: {
      kind: "string",
      default: "previews/blender",
      help: "where make blender left the glTFs",
    },
  },
  "usage: node scripts/models.mjs [--check] [--from=previews/blender]",
);

const out = join(root, MODELS_DIR);
const stampAt = join(out, "sources.json");
const stamp = modelStamp(root);
const had = existsSync(stampAt) ? JSON.parse(readFileSync(stampAt, "utf8")) : {};

if (args.check) {
  const fresh = had.sources === stamp;
  console.log(fresh ? "pwa/models/ is fresh" : "pwa/models/ is STALE — run `make models`");
  process.exit(fresh ? 0 : 1);
}

/** Each published name and the file `make blender` wrote it as. */
const made = (name) => join(root, args.from, name.replace(".glb", "-lod0.glb"));
const names = modelFiles({ crafts: true, riders: true });
const missing = names.filter((n) => !existsSync(made(n)));
if (missing.length) {
  console.error(
    `not made: ${missing.map(made).join(", ")} — run make blender's game quality first`,
  );
  process.exit(1);
}
mkdirSync(out, { recursive: true });
for (const n of names) {
  copyFileSync(made(n), join(out, n));
  console.log(
    `${MODELS_DIR}/${n}  ${(readFileSync(join(out, n)).byteLength / 1024).toFixed(0)} KiB`,
  );
}
writeFileSync(stampAt, `${JSON.stringify({ sources: stamp, blender: "5.2.2" }, null, 2)}\n`);
console.log(`${MODELS_DIR}/sources.json  ${stamp.slice(0, 12)}`);
