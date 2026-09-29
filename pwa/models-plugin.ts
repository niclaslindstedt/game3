// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELS EVERY BUILD PACKS: every craft's game-quality glTF as
// `models/<id>.glb`, the rider's as `models/rider.glb`, and every static
// SET's kinds under their own directory (`models/trees/<kind>.glb`,
// `models/undergrowth/<kind>.glb`, `models/rocks/<kind>.glb`,
// `models/marks/<kind>.glb`, `models/birds/<id>.glb`, `models/fauna/<id>.glb` —
// `MODEL_SETS` is the list), emitted into the
// bundle (so the service worker precaches them with everything else) and
// served the same way by the dev server. They are COMMITTED, in
// `pwa/models/`, made there by `make models` (Blender, off the game's own
// data — the `blender-assets` skill), with a stamp of what they were made
// from (`sources.json`, `models-stamp.ts`), which `tests/models_test.ts`
// holds to the tree as it stands: a model older than its data fails the
// suite.
//
// A build switched back to a set's code-built kind (`VITE_MODEL_CRAFTS=0`,
// `VITE_MODEL_RIDERS=0`, `VITE_MODEL_TREES=0`, `VITE_MODEL_UNDERGROWTH=0`,
// `VITE_MODEL_ROCKS=0`, `VITE_MODEL_MARKS=0`, `VITE_MODEL_BIRDS=0`,
// `VITE_MODEL_FAUNA=0` — `src/game/model-switch.ts`) packs none of that
// set's files.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { Plugin } from "vite";

import { CRAFT_IDS } from "../engine/game/defs/craft.ts";
import { FAUNA_IDS } from "../engine/game/defs/fauna.ts";
import { BIRD_IDS } from "./src/game/bird-defs.ts";
import { MARK_KINDS } from "./src/game/mark-shapes.ts";
import { ROCK_KINDS } from "./src/game/rock-variants.ts";
import { TREE_KINDS } from "./src/game/tree-variants.ts";
import { UNDER_KINDS } from "./src/game/undergrowth-variants.ts";

/** THE SETS OF MODELS, one row each: the published directory under
 * `pwa/models/` (none for the machines), its kinds (each `<kind>.glb`),
 * whether `make models` packs it with meshopt (the static sets; a skinned
 * craft is copied as Blender wrote it), the build switch that turns it
 * back, and the stamp in `sources.json` it is held to
 * (`models-stamp.ts`). Adding a set is a row here, its stamp, and its
 * loader. */
export type ModelSetKey =
  "crafts" | "riders" | "trees" | "undergrowth" | "rocks" | "marks" | "birds" | "fauna";
export type ModelSet = {
  key: ModelSetKey;
  dir: string;
  kinds: readonly string[];
  packed: boolean;
  switch: string;
  stamp: "sources" | "trees" | "undergrowth" | "rocks" | "marks" | "birds" | "fauna";
};
export const MODEL_SETS: readonly ModelSet[] = [
  {
    key: "crafts",
    dir: "",
    kinds: CRAFT_IDS,
    packed: false,
    switch: "VITE_MODEL_CRAFTS",
    stamp: "sources",
  },
  {
    key: "riders",
    dir: "",
    kinds: ["rider"],
    packed: false,
    switch: "VITE_MODEL_RIDERS",
    stamp: "sources",
  },
  {
    key: "trees",
    dir: "trees",
    kinds: TREE_KINDS,
    packed: true,
    switch: "VITE_MODEL_TREES",
    stamp: "trees",
  },
  {
    key: "undergrowth",
    dir: "undergrowth",
    kinds: UNDER_KINDS,
    packed: true,
    switch: "VITE_MODEL_UNDERGROWTH",
    stamp: "undergrowth",
  },
  {
    key: "rocks",
    dir: "rocks",
    kinds: ROCK_KINDS,
    packed: true,
    switch: "VITE_MODEL_ROCKS",
    stamp: "rocks",
  },
  {
    key: "marks",
    dir: "marks",
    kinds: MARK_KINDS,
    packed: true,
    switch: "VITE_MODEL_MARKS",
    stamp: "marks",
  },
  {
    key: "birds",
    dir: "birds",
    kinds: BIRD_IDS,
    packed: true,
    switch: "VITE_MODEL_BIRDS",
    stamp: "birds",
  },
  {
    key: "fauna",
    dir: "fauna",
    kinds: FAUNA_IDS,
    packed: true,
    switch: "VITE_MODEL_FAUNA",
    stamp: "fauna",
  },
];

export type ModelSwitches = Record<ModelSetKey, boolean>;

/** Every switch on: what `make models` publishes and the suite checks. */
export const ALL_MODELS: ModelSwitches = Object.fromEntries(
  MODEL_SETS.map((s) => [s.key, true]),
) as ModelSwitches;

/** Where the committed models are, from the repository's root. */
export const MODELS_DIR = "pwa/models";

/** A set's published name for one of its kinds. */
export function modelFile(set: ModelSet, kind: string): string {
  return `${set.dir ? `${set.dir}/` : ""}${kind}.glb`;
}

/** Every file a build with these switches packs, by its published name. */
export function modelFiles(on: ModelSwitches): string[] {
  return MODEL_SETS.flatMap((s) => (on[s.key] ? s.kinds.map((k) => modelFile(s, k)) : []));
}

export function craftModels(on: ModelSwitches, root: string): Plugin {
  const dir = join(root, MODELS_DIR);
  const files = modelFiles(on);
  return {
    name: "craft-models",
    buildStart() {
      const gone = files.filter((f) => !existsSync(join(dir, f)));
      if (gone.length) {
        this.error(
          `${gone.map((f) => `${MODELS_DIR}/${f}`).join(", ")} is missing — run \`make models\` ` +
            "(it needs Blender), or switch the build back to the code-built ones " +
            `(${MODEL_SETS.map((s) => `${s.switch}=0`).join(" / ")})`,
        );
      }
    },
    generateBundle() {
      for (const f of files) {
        this.emitFile({
          type: "asset",
          fileName: `models/${f}`,
          source: readFileSync(join(dir, f)),
        });
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = /\/models\/((?:[\w-]+\/)?[\w-]+\.glb)$/.exec(req.url ?? "")?.[1];
        if (!name || !files.includes(name) || !existsSync(join(dir, name))) return next();
        res.setHeader("Content-Type", "model/gltf-binary");
        res.end(readFileSync(join(dir, name)));
      });
    },
  };
}
