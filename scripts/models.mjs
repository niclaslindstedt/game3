#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELS THE GAME SHIPS, published: the last step of `make models`
// (which first runs `make blender`'s game quality for every kind of every
// set). Copies each craft's and the rider's LOD0 glTF out of the gitignored
// `previews/blender/` into the committed `pwa/models/` under the name the
// build packs it by (`<id>.glb`, `rider.glb`), PACKS every static set's
// kinds (`scripts/lib/glb-pack.mjs`: quantized and meshopt-compressed) into
// their set's directory (`pwa/models/trees/<kind>.glb`, …), and writes
// `pwa/models/sources.json` — the hash of everything each set is made from
// (`MODEL_STAMPS` in `pwa/models-stamp.ts`), which `tests/models_test.ts`
// holds to the tree. `MODEL_SETS` (`pwa/models-plugin.ts`) is the list of
// sets. A set not published keeps its stamp: it was not remade.
//
//   node scripts/models.mjs                  publish what `make blender` made
//   node scripts/models.mjs --set=trees      one set (machines: the crafts and the rider)
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
const { MODELS_DIR, MODEL_SETS, modelFile } = await import("../pwa/models-plugin.ts");
const { MODEL_STAMPS } = await import("../pwa/models-stamp.ts");

/** The sets `--set` names: `machines` is the crafts and the rider together. */
const SETS = [
  "all",
  "machines",
  ...MODEL_SETS.map((s) => s.key).filter((k) => !["crafts", "riders"].includes(k)),
];
const args = parseArgs(
  process.argv.slice(2),
  {
    check: { kind: "flag", help: "only report whether pwa/models/ is fresh against its sources" },
    set: {
      kind: "string",
      default: "all",
      help: `which set to publish: ${SETS.join(", ")}`,
    },
    from: {
      kind: "string",
      default: "previews/blender",
      help: "where make blender left the glTFs",
    },
  },
  `usage: node scripts/models.mjs [--check] [--set=${SETS.join("|")}] [--from=previews/blender]`,
);
if (!SETS.includes(args.set)) {
  console.error(`unknown set "${args.set}" (${SETS.join(", ")})`);
  process.exit(2);
}

const out = join(root, MODELS_DIR);
const stampAt = join(out, "sources.json");
const stamps = Object.fromEntries(Object.entries(MODEL_STAMPS).map(([k, fn]) => [k, fn(root)]));
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

/** The sets this run publishes. */
const chosen = MODEL_SETS.filter(
  (s) =>
    args.set === "all" ||
    (args.set === "machines" ? ["crafts", "riders"].includes(s.key) : s.key === args.set),
);
/** Each published name and the file `make blender` wrote it as: a static
 * set's `<kind>.glb`, a machine's `<id>-lod0.glb`. */
const made = (set, kind) => join(root, args.from, set.packed ? `${kind}.glb` : `${kind}-lod0.glb`);
const jobs = chosen.flatMap((set) => set.kinds.map((kind) => ({ set, kind })));
const missing = jobs.filter(({ set, kind }) => !existsSync(made(set, kind)));
if (missing.length) {
  console.error(
    `not made: ${missing.map(({ set, kind }) => made(set, kind)).join(", ")} — run make blender's game quality first`,
  );
  process.exit(1);
}
for (const { set, kind } of jobs) {
  const n = modelFile(set, kind);
  mkdirSync(dirname(join(out, n)), { recursive: true });
  if (set.packed) {
    writeFileSync(join(out, n), await packGlb(readFileSync(made(set, kind))));
  } else {
    copyFileSync(made(set, kind), join(out, n));
  }
  console.log(
    `${MODELS_DIR}/${n}  ${(readFileSync(join(out, n)).byteLength / 1024).toFixed(0)} KiB`,
  );
}
// A stamp is rewritten only for a set that was published; the rest keep
// theirs — they were not remade.
const remade = new Set(chosen.map((s) => s.stamp));
const stamp = Object.fromEntries(
  Object.keys(stamps).map((k) => [k, remade.has(k) ? stamps[k] : had[k]]),
);
stamp.blender = "5.2.2";
writeFileSync(stampAt, `${JSON.stringify(stamp, null, 2)}\n`);
console.log(
  `${MODELS_DIR}/sources.json  ${Object.keys(stamps)
    .map((k) => `${k} ${stamp[k]?.slice(0, 12)}`)
    .join(" · ")}`,
);
