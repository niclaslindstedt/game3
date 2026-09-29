// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELLED UNDERGROWTH (`pwa/src/game/tree-models.ts` carries it beside
// the trees; made by `make blender KIND=undergrowth` off
// `undergrowth-variants.ts`, published packed in `pwa/models/undergrowth/`):
// every bush, tuft, reed and stone row of the roster is a kind with its four
// variants, and nothing else is — so every row of the roster is either a
// tree's kind or one of these; the code's builder reads its numbers from the
// one table the models are made from; every committed kind decodes, through
// three's own loader and meshopt decoder, to all four variants, in the unit
// frame, within the budget and within reach of the code's own outline; and
// a kind whose model is missing is left to the code.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { describe, expect, it } from "vitest";

import { FLORA } from "../pwa/src/game/flora-defs.ts";
import { buildFlora } from "../pwa/src/game/flora-shapes.ts";
import { partsOf, setTreeModel, treeModel } from "../pwa/src/game/tree-models.ts";
import { TREE_KINDS } from "../pwa/src/game/tree-variants.ts";
import {
  UNDER_FORMS,
  UNDER_KINDS,
  UNDER_ROWS,
  UNDER_SHAPE,
  UNDER_VARIANTS,
  isUnderForm,
  underSpec,
} from "../pwa/src/game/undergrowth-variants.ts";

const root = join(import.meta.dirname, "..");

/** The triangle budget a variant of each form may cost — the code's own
 * shape is 20–220 triangles; a model is the near band alone, so it may spend
 * more, and the reeds most: a bed is canes, leaves and plumes. */
const BUDGET: Record<(typeof UNDER_FORMS)[number], number> = {
  bush: 1400,
  tuft: 600,
  reed: 1300,
  stone: 160,
};

describe("the undergrowth kinds", () => {
  it("are every other row of the roster: a row is a tree's kind or one of these", () => {
    for (const s of FLORA) {
      const tree = TREE_KINDS.includes(s.id);
      const under = UNDER_KINDS.includes(s.id);
      expect(tree !== under, `${s.id} is exactly one of a tree and undergrowth`).toBe(true);
      expect(under, s.id).toBe(isUnderForm(s.look.form));
    }
    for (const id of ["juniper", "willow", "heather", "reed", "stone", "myrtle", "posidonia"]) {
      expect(UNDER_KINDS, id).toContain(id);
    }
  });

  it("have four variants each, the first the row's own plant, all of one form", () => {
    for (const kind of UNDER_KINDS) {
      const rows = UNDER_ROWS[kind];
      const look = underSpec(kind).look;
      expect(rows.length, kind).toBe(UNDER_VARIANTS);
      rows.forEach((v, i) => {
        expect(v.index).toBe(i);
        expect(v.shape.form, `${kind} ${i}`).toBe(look.form);
        expect(v.spread, `${kind} ${i}`).toBeGreaterThan(0);
        expect(v.top, `${kind} ${i}`).toBeGreaterThan(0);
        expect(v.stems, `${kind} ${i}`).toBeGreaterThan(0);
      });
      expect(rows[0].spread, kind).toBe(1);
      expect(rows[0].top, kind).toBe(1);
      expect(rows[0].stems, kind).toBe(look.stems);
      expect(rows[0].bare, kind).toBe(look.bare);
    }
  });

  it("state every form's proportions once, where the code's builder reads them", () => {
    for (const form of UNDER_FORMS) expect(UNDER_SHAPE[form], form).toBeDefined();
    // The facet ladder the code's bush builder climbs at a metre and a half.
    expect(UNDER_SHAPE.bush.facets.length).toBe(2);
    expect(UNDER_SHAPE.bush.small).toBe(1.5);
  });
});

describe("the committed undergrowth models", () => {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const parse = async (kind: string) => {
    const b = readFileSync(join(root, "pwa", "models", "undergrowth", `${kind}.glb`));
    const g = await loader.parseAsync(
      b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer,
      "",
    );
    return partsOf(g);
  };

  it("decode to every variant of every kind, in the frame, the budget and the code's outline", async () => {
    for (const kind of UNDER_KINDS) {
      setTreeModel(kind, await parse(kind));
      const spec = underSpec(kind);
      const form = spec.look.form as (typeof UNDER_FORMS)[number];
      // The code's own plant, a metre tall: what a model is held against.
      const code = buildFlora(spec.look, FLORA.indexOf(spec) * 7919 + 13);
      code.computeBoundingBox();
      const cb = code.boundingBox as THREE.Box3;
      const codeWidth = Math.max(cb.max.x - cb.min.x, cb.max.z - cb.min.z);
      for (let i = 0; i < UNDER_VARIANTS; i++) {
        const v = UNDER_ROWS[kind][i];
        const g = treeModel(kind, i);
        const what = `${kind} ${i}`;
        expect(g, what).not.toBeNull();
        const tris = g!.index!.count / 3;
        expect(tris, what).toBeLessThan(BUDGET[form]);
        expect(tris, what).toBeGreaterThan(12);
        expect(g!.getAttribute("color").count, what).toBe(g!.getAttribute("position").count);
        g!.computeBoundingBox();
        const box = g!.boundingBox as THREE.Box3;
        // Its foot in the ground, its top near the code plant's — a variant's
        // own share of it, give or take what the modelling adds (a seed head
        // over a clump, a plume nodding under its own weight).
        expect(box.min.y, what).toBeLessThan(0.02);
        expect(box.max.y / (cb.max.y * v.top), what).toBeGreaterThan(0.5);
        expect(box.max.y / (cb.max.y * v.top), what).toBeLessThan(1.5);
        // And the width of the code's plant, give or take what a variant
        // departs from it by and what the modelling spreads.
        const width = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
        expect(width / (codeWidth * v.spread), what).toBeGreaterThan(0.45);
        expect(width / (codeWidth * v.spread), what).toBeLessThan(2.4);
      }
      // No sketch: the undergrowth has one band.
      expect(treeModel(kind, 0, true), kind).toBeNull();
    }
  });

  it("leave a kind with no model to the code's builder", () => {
    setTreeModel("heather", new Map());
    expect(treeModel("heather", 0)).toBeNull();
  });
});
