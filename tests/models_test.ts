// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELLED CRAFTS AND RIDER the game ships (`pwa/models/`, made by
// `make models`, packed by `pwa/models-plugin.ts`, drawn by
// `craft-models.ts`): every one committed, none older than what it is made
// from, each within its budget; the switches on unless a build turns one
// back; and every material the Blender builders name dressed as the code's
// own craft, or the code's own rider, would be painted. The names are
// stated twice — in `scripts/blender/*.py`, which cannot import a module of
// the game, and in `dressOf` — so the builders are read here as TEXT, the
// way `tauri_test.ts` reads the Rust.

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { CRAFT_IDS } from "@engine";

import { MODELS_DIR, modelFiles } from "../pwa/models-plugin.ts";
import { modelStamp } from "../pwa/models-stamp.ts";
import { dressOf } from "../pwa/src/game/craft-models.ts";
import { CRAFT_STYLES } from "../pwa/src/game/craft-styles.ts";
import { FINISH } from "../pwa/src/game/craft-surface.ts";
import { modelSwitch } from "../pwa/src/game/model-switch.ts";
import { PAINT, RIDER_FINISH } from "../pwa/src/game/rider.ts";

const root = join(import.meta.dirname, "..");
const builder = (file: string): string =>
  readFileSync(join(root, "scripts", "blender", file), "utf8");
/** Every material a builder makes by a literal name (`= mat("hull", …)`). */
const matNames = (file: string): string[] =>
  [...builder(file).matchAll(/= mat\("(\w+)"/g)].map((m) => m[1]);
/** The rider's: one material a key of its `FINISH` table. */
const kitNames = (): string[] => {
  const table = /^FINISH = \{([\s\S]*?)\}$/m.exec(builder("rider.py"))?.[1] ?? "";
  return [...table.matchAll(/"(\w+)":/g)].map((m) => m[1]);
};
const kit = { paint: PAINT, finish: RIDER_FINISH };

describe("the models the game ships", () => {
  const all = modelFiles({ crafts: true, riders: true });

  it("are every craft under its id and one rider", () => {
    expect([...all].sort()).toEqual([...CRAFT_IDS.map((id) => `${id}.glb`), "rider.glb"].sort());
    expect(modelFiles({ crafts: false, riders: true })).toEqual(["rider.glb"]);
    expect(modelFiles({ crafts: false, riders: false })).toEqual([]);
  });

  it("are all committed, each within its budget", () => {
    for (const f of all) {
      const at = join(root, MODELS_DIR, f);
      expect(existsSync(at), `${MODELS_DIR}/${f} — run \`make models\``).toBe(true);
      // A craft's LOD0 is ~0.6 MB, the rider's ~0.5 MB: a model grown past
      // this is a builder that lost its game budget.
      const budget = f === "rider.glb" ? 900_000 : 1_600_000;
      expect(statSync(at).size, f).toBeLessThan(budget);
    }
  });

  it("are no older than what they are made from", () => {
    const stamp = JSON.parse(readFileSync(join(root, MODELS_DIR, "sources.json"), "utf8")) as {
      sources: string;
    };
    expect(
      stamp.sources,
      "a builder, or the game's data a model is made of, moved since the models were made — run `make models` and commit pwa/models/",
    ).toBe(modelStamp(root));
  });
});

describe("the model switches", () => {
  it("are on unless a build turns one back", () => {
    for (const on of [undefined, "", "1", "on", "true", "yes"]) expect(modelSwitch(on)).toBe(true);
    for (const off of ["0", "off", "OFF", "false", "no", " 0 "]) {
      expect(modelSwitch(off)).toBe(false);
    }
  });
});

describe("a model's dress", () => {
  const style = CRAFT_STYLES.skiff;

  it("dresses every material the craft builder names", () => {
    const names = matNames("craft.py");
    for (const n of ["hull", "topside", "rail", "deck", "seat", "seatTop", "tray", "bar", "grip"]) {
      expect(names, `craft.py names "${n}"`).toContain(n);
    }
    for (const n of names) expect(dressOf(n, style, null), `craft.py's "${n}"`).not.toBeNull();
  });

  it("dresses every material the rider builder names, in the kit's paint", () => {
    const names = kitNames();
    expect([...names].sort()).toEqual(Object.keys(PAINT).sort());
    for (const n of names) {
      expect(dressOf(n, null, kit)).toEqual({
        colour: PAINT[n as keyof typeof PAINT],
        finish: RIDER_FINISH[n as keyof typeof PAINT],
      });
    }
  });

  it("paints a craft in its own style, finished as the code's builder finishes it", () => {
    for (const id of CRAFT_IDS) {
      const s = CRAFT_STYLES[id];
      expect(dressOf("hull", s, null)).toEqual({ colour: s.hull, finish: FINISH.gelcoat });
      expect(dressOf("deck", s, null)).toEqual({ colour: s.deck, finish: FINISH.paint });
      expect(dressOf("seat", s, null)).toEqual({ colour: s.seat, finish: FINISH.vinyl });
      expect(dressOf("grip", s, null)).toEqual({ colour: s.grip, finish: FINISH.rubber });
      expect(dressOf("trim", s, null)).toEqual({ colour: s.rail, finish: FINISH.moulding });
    }
    expect(dressOf("suit", style, null)).toBeNull();
    expect(dressOf("hull", null, kit)).toBeNull();
    expect(dressOf("shape", style, null)).toBeNull();
  });
});
