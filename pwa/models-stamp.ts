// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A COMMITTED MODEL WAS MADE FROM, as one hash: the Blender builders
// and their driver as text, and the game's own data every model is handed
// (`src/game/model-data.ts` — each craft's and the rider's JSON, exactly
// what `make blender` writes out). `scripts/models.mjs` writes it into
// `pwa/models/sources.json` when it publishes; `tests/models_test.ts`
// recomputes it off the tree as it stands, so a change to anything a model
// is made of — a builder, a station table, a style's colour, the rider's
// pose — fails the suite until `make models` is run and `pwa/models/`
// committed with it, and a change to nothing a model reads (a sea-state
// number in `TUNING`, say) moves nothing.
//
// THE TREES ARE STAMPED APART (`treeStamp`): their builder, the shelf and
// the driver, the packer every published tree goes through, and every
// kind's SHAPE data (`treeModelData` — no colour, which the game dresses a
// model in), so a tree remade never asks for the crafts to be, nor the other
// way round; `blender.mjs` and `lib.py` are in both lists.
//
// The numbers are hashed at a hundredth of a millimetre: a figure that
// differs in its last bits between two machines' maths is not a model that
// moved.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  MODELLED_CRAFTS,
  MODELLED_TREES,
  craftModelData,
  riderModelData,
  treeModelData,
} from "./src/game/model-data.ts";

/** The builders and the driver, from the repository's root. */
export const MODEL_BUILDERS = [
  "scripts/blender.mjs",
  "scripts/blender/lib.py",
  "scripts/blender/craft.py",
  "scripts/blender/rider.py",
];

/** …and the trees'. */
export const TREE_BUILDERS = [
  "scripts/blender.mjs",
  "scripts/blender/lib.py",
  "scripts/blender/tree.py",
  "scripts/lib/glb-pack.mjs",
];

const rounded = (_key: string, v: unknown): unknown =>
  typeof v === "number" ? Math.round(v * 1e5) / 1e5 : v;

/** The hash every committed model is stamped with, from `root` (line
 * endings as committed: `\r` dropped, so a checkout's conversion moves
 * nothing). */
export function modelStamp(root: string): string {
  const h = createHash("sha256");
  texts(h, root, MODEL_BUILDERS);
  for (const id of MODELLED_CRAFTS) h.update(JSON.stringify(craftModelData(id), rounded));
  h.update(JSON.stringify(riderModelData(), rounded));
  return h.digest("hex");
}

/** The hash every committed TREE is stamped with, from `root`. */
export function treeStamp(root: string): string {
  const h = createHash("sha256");
  texts(h, root, TREE_BUILDERS);
  for (const kind of MODELLED_TREES) h.update(JSON.stringify(treeModelData(kind), rounded));
  return h.digest("hex");
}

function texts(h: ReturnType<typeof createHash>, root: string, files: readonly string[]): void {
  for (const f of files) {
    h.update(`${f}\n`);
    h.update(readFileSync(join(root, f), "utf8").replaceAll("\r", ""));
  }
}
