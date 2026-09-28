// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELS EVERY BUILD PACKS: every craft's game-quality glTF as
// `models/<id>.glb` and the rider's as `models/rider.glb`, emitted into the
// bundle (so the service worker precaches them with everything else) and
// served the same way by the dev server. They are COMMITTED, in
// `pwa/models/`, made there by `make models` (Blender, off the game's own
// data — the `blender-assets` skill), with a stamp of what they were made
// from (`sources.json`, `models-stamp.ts`), which `tests/models_test.ts`
// holds to the tree as it stands: a model older than its data fails the
// suite.
//
// A build switched back to the code-built crafts or rider
// (`VITE_MODEL_CRAFTS=0`, `VITE_MODEL_RIDERS=0` — `src/game/model-switch.ts`)
// packs none of that side's files.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { Plugin } from "vite";

import { CRAFT_IDS } from "../engine/game/defs/craft.ts";

export type ModelSwitches = { crafts: boolean; riders: boolean };

/** Where the committed models are, from the repository's root. */
export const MODELS_DIR = "pwa/models";

/** Every file a build with these switches packs, by its published name. */
export function modelFiles(on: ModelSwitches): string[] {
  return [
    ...(on.crafts ? CRAFT_IDS.map((id) => `${id}.glb`) : []),
    ...(on.riders ? ["rider.glb"] : []),
  ];
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
            "(VITE_MODEL_CRAFTS=0 / VITE_MODEL_RIDERS=0)",
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
        const name = /\/models\/([\w-]+\.glb)$/.exec(req.url ?? "")?.[1];
        if (!name || !files.includes(name) || !existsSync(join(dir, name))) return next();
        res.setHeader("Content-Type", "model/gltf-binary");
        res.end(readFileSync(join(dir, name)));
      });
    },
  };
}
