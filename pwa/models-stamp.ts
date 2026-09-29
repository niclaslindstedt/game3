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
// way round; `blender.mjs` and `lib.py` are in both lists. THE UNDERGROWTH
// LIKEWISE (`undergrowthStamp`), over its own builder and the foliage shelf
// it shares with the trees (`foliage.py`, in both plant stamps), AND THE
// ROCKS (`rockStamp`), THE MARKS (`markStamp`), THE BIRDS (`birdStamp`) AND
// THE SEA LIFE (`faunaStamp`); `MODEL_STAMPS` is the one list.
//
// The numbers are hashed at a hundredth of a millimetre: a figure that
// differs in its last bits between two machines' maths is not a model that
// moved.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  MODELLED_BIRDS,
  MODELLED_CRAFTS,
  MODELLED_FAUNA,
  MODELLED_MARKS,
  MODELLED_ROCKS,
  MODELLED_TREES,
  MODELLED_UNDERGROWTH,
  birdModelData,
  craftModelData,
  faunaModelData,
  markModelData,
  riderModelData,
  rockModelData,
  treeModelData,
  undergrowthModelData,
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
  "scripts/blender/foliage.py",
  "scripts/blender/tree.py",
  "scripts/lib/glb-pack.mjs",
];

/** …and the undergrowth's. */
export const UNDERGROWTH_BUILDERS = [
  "scripts/blender.mjs",
  "scripts/blender/lib.py",
  "scripts/blender/foliage.py",
  "scripts/blender/undergrowth.py",
  "scripts/lib/glb-pack.mjs",
];

/** …and the rocks'. */
export const ROCK_BUILDERS = [
  "scripts/blender.mjs",
  "scripts/blender/lib.py",
  "scripts/blender/foliage.py",
  "scripts/blender/rock.py",
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

/** The hash every committed piece of UNDERGROWTH is stamped with, from `root`. */
export function undergrowthStamp(root: string): string {
  const h = createHash("sha256");
  texts(h, root, UNDERGROWTH_BUILDERS);
  for (const kind of MODELLED_UNDERGROWTH) {
    h.update(JSON.stringify(undergrowthModelData(kind), rounded));
  }
  return h.digest("hex");
}

/** …and the marks'. */
export const MARK_BUILDERS = [
  "scripts/blender.mjs",
  "scripts/blender/lib.py",
  "scripts/blender/foliage.py",
  "scripts/blender/mark.py",
  "scripts/lib/glb-pack.mjs",
];

/** The hash every committed MARK is stamped with, from `root`. */
export function markStamp(root: string): string {
  const h = createHash("sha256");
  texts(h, root, MARK_BUILDERS);
  for (const kind of MODELLED_MARKS) h.update(JSON.stringify(markModelData(kind), rounded));
  return h.digest("hex");
}

/** …and the birds'. */
export const BIRD_BUILDERS = [
  "scripts/blender.mjs",
  "scripts/blender/lib.py",
  "scripts/blender/foliage.py",
  "scripts/blender/bird.py",
  "scripts/lib/glb-pack.mjs",
];

/** The hash every committed BIRD is stamped with, from `root`. */
export function birdStamp(root: string): string {
  const h = createHash("sha256");
  texts(h, root, BIRD_BUILDERS);
  for (const id of MODELLED_BIRDS) h.update(JSON.stringify(birdModelData(id), rounded));
  return h.digest("hex");
}

/** …and the sea life's. */
export const FAUNA_BUILDERS = [
  "scripts/blender.mjs",
  "scripts/blender/lib.py",
  "scripts/blender/foliage.py",
  "scripts/blender/fauna.py",
  "scripts/lib/glb-pack.mjs",
];

/** The hash every committed animal is stamped with, from `root`. */
export function faunaStamp(root: string): string {
  const h = createHash("sha256");
  texts(h, root, FAUNA_BUILDERS);
  for (const id of MODELLED_FAUNA) h.update(JSON.stringify(faunaModelData(id), rounded));
  return h.digest("hex");
}

/** The hash every committed ROCK is stamped with, from `root`. */
export function rockStamp(root: string): string {
  const h = createHash("sha256");
  texts(h, root, ROCK_BUILDERS);
  for (const kind of MODELLED_ROCKS) h.update(JSON.stringify(rockModelData(kind), rounded));
  return h.digest("hex");
}

/** Every stamp `sources.json` carries, by its key (`MODEL_SETS` names
 * which set is held to which). */
export const MODEL_STAMPS: Record<string, (root: string) => string> = {
  sources: modelStamp,
  trees: treeStamp,
  undergrowth: undergrowthStamp,
  rocks: rockStamp,
  marks: markStamp,
  birds: birdStamp,
  fauna: faunaStamp,
};

function texts(h: ReturnType<typeof createHash>, root: string, files: readonly string[]): void {
  for (const f of files) {
    h.update(`${f}\n`);
    h.update(readFileSync(join(root, f), "utf8").replaceAll("\r", ""));
  }
}
