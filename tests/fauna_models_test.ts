// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELLED SEA LIFE (`pwa/src/game/fauna-models.ts`, made by `make
// blender KIND=fauna` off the catalog, the styles and `fauna-body.ts`,
// published packed in `pwa/models/fauna/`): every species is modelled; the
// code's builder reads its body numbers from the one table the models are
// made to; the roles the builder paints with are the game's; and every
// committed species decodes, through three's own loader and meshopt
// decoder, in the code's frame — a unit body from the tail at −0.5 to the
// nose at +0.5, as wide as the catalog's beam — its hide painted at both
// shades by the code's own `hide`, within the budget.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { describe, expect, it } from "vitest";
import { FAUNA } from "@engine";

import { BODY, FAUNA_ROLES, GIRTH, girthAt } from "../pwa/src/game/fauna-body.ts";
import { faunaModel, hasFaunaModel, setFaunaModel } from "../pwa/src/game/fauna-models.ts";
import { STYLES } from "../pwa/src/game/fauna-styles.ts";
import { hide } from "../pwa/src/game/fauna.ts";
import { partsOf } from "../pwa/src/game/tree-models.ts";

const root = join(import.meta.dirname, "..");

/** The roles `fauna.py` paints with, read off its text. */
function builderRoles(): string[] {
  const src = readFileSync(join(root, "scripts", "blender", "fauna.py"), "utf8");
  const m = /^ROLES = \(([^)]*)\)/m.exec(src);
  if (!m) throw new Error("fauna.py states no ROLES");
  return [...m[1].matchAll(/"(\w+)"/g)].map((x) => x[1]);
}

describe("the sea life's body", () => {
  it("states the girth the code lofts, widest a third back from the nose", () => {
    expect(GIRTH[0][0]).toBe(0);
    expect(GIRTH[GIRTH.length - 1][0]).toBe(1);
    expect(girthAt(0.7)).toBe(1);
    expect(girthAt(0)).toBeLessThan(0.1);
    expect(girthAt(1)).toBeLessThan(0.1);
    expect(BODY.shadeDeep).toBeGreaterThan(BODY.shadeWet);
    expect(builderRoles()).toEqual([...FAUNA_ROLES]);
  });
});

describe("the committed sea life models", () => {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const parse = async (id: string) => {
    const b = readFileSync(join(root, "pwa", "models", "fauna", `${id}.glb`));
    const g = await loader.parseAsync(
      b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer,
      "",
    );
    return partsOf(g, /^body$/).get("body") ?? [];
  };

  it("decode every species as a unit body in the code's frame, painted twice, within the budget", async () => {
    for (const spec of FAUNA) {
      setFaunaModel(spec.id, await parse(spec.id));
      expect(hasFaunaModel(spec.id), spec.id).toBe(true);
      const style = STYLES[spec.id];
      const g = faunaModel(spec.id, style, hide)!;
      expect(g, spec.id).not.toBeNull();
      const tris = g.index!.count / 3;
      expect(tris, spec.id).toBeLessThan(1400);
      expect(tris, spec.id).toBeGreaterThan(150);
      const pos = g.getAttribute("position");
      expect(g.getAttribute("color").count, spec.id).toBe(pos.count);
      expect(g.getAttribute("aDeep").count, spec.id).toBe(pos.count);
      g.computeBoundingBox();
      const box = g.boundingBox as THREE.Box3;
      // Nose at +0.5 and the tail's tip past −0.5 (the flukes reach past
      // the root), as wide as the beam or the fins, no wider than either.
      expect(box.max.z, spec.id).toBeCloseTo(0.5, 1);
      expect(box.min.z, spec.id).toBeLessThan(-0.5);
      expect(box.min.z, spec.id).toBeGreaterThan(-0.72);
      const wide = Math.max(spec.beam / 2 + style.pectoral, style.tail / 2, (spec.beam / 2) * 1.2);
      expect(box.max.x, spec.id).toBeLessThanOrEqual(wide + 0.05);
      expect(box.max.x, spec.id).toBeGreaterThan(spec.beam * 0.4);
      // The hide painted at the wet shade differs from the deep one where
      // the flank is, and the deep one is the paler.
      const wet = g.getAttribute("color");
      const deep = g.getAttribute("aDeep");
      let paler = 0;
      for (let i = 0; i < pos.count; i++) {
        const w = wet.getX(i) + wet.getY(i) + wet.getZ(i);
        const d = deep.getX(i) + deep.getY(i) + deep.getZ(i);
        if (d > w + 1e-4) paler++;
      }
      expect(paler, `${spec.id}: some of the hide lifted for deep water`).toBeGreaterThan(0);
    }
  });

  it("leave a species with no model to the code's builder", () => {
    setFaunaModel("herring", []);
    expect(hasFaunaModel("herring")).toBe(false);
    expect(faunaModel("herring", STYLES.herring, hide)).toBeNull();
  });
});
