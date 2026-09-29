// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELLED TREES (`pwa/src/game/tree-models.ts`, made by `make blender
// KIND=tree` off `tree-variants.ts`, published packed in
// `pwa/models/trees/`): every tree-form row of the roster is a kind with its
// six variants, and nothing else is; the code's builder reads its tree
// numbers from the one table the models are made from; every role the
// builder paints a face with is one the game can dress, in the kind's own
// colours; a model stands in the unit frame the placer scales it in; and
// every committed kind decodes, through three's own loader and meshopt
// decoder, to all six variants in both bands, in the frame, within the
// budget and within reach of the code's own silhouette.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { describe, expect, it } from "vitest";

import { FLORA } from "../pwa/src/game/flora-defs.ts";
import { buildFlora } from "../pwa/src/game/flora-shapes.ts";
import {
  partsOf,
  roleColours,
  setTreeModel,
  treeModel,
  type TreePart,
} from "../pwa/src/game/tree-models.ts";
import {
  TREE_FORMS,
  TREE_KINDS,
  TREE_REFERENCE,
  TREE_VARIANTS,
  VARIANTS,
  crownAt,
  isTreeForm,
  treeSpec,
  variantIndex,
} from "../pwa/src/game/tree-variants.ts";

const root = join(import.meta.dirname, "..");

/** The roles `tree.py` paints with, read off its text. */
function builderRoles(): string[] {
  const src = readFileSync(join(root, "scripts", "blender", "tree.py"), "utf8");
  const m = /^ROLES = \(([^)]*)\)/m.exec(src);
  if (!m) throw new Error("tree.py states no ROLES");
  return [...m[1].matchAll(/"(\w+)"/g)].map((x) => x[1]);
}

/** A one-triangle part at `y` metres up, in one role, with one tone. */
function part(role: string, tone: [number, number, number], y = 5): TreePart {
  const R = TREE_REFERENCE;
  return {
    role,
    position: Float32Array.from([0, y, 0, R, y, 0, 0, y, R]),
    normal: Float32Array.from([0, 1, 0, 0, 1, 0, 0, 1, 0]),
    tone: Float32Array.from([...tone, ...tone, ...tone]),
    index: Uint32Array.from([0, 1, 2]),
  };
}

describe("the tree kinds", () => {
  it("are every tree-form row of the roster, and only those", () => {
    const trees = FLORA.filter((s) => isTreeForm(s.look.form)).map((s) => s.id);
    expect([...TREE_KINDS]).toEqual(trees);
    for (const s of FLORA) {
      expect(TREE_KINDS.includes(s.id), s.id).toBe(
        (TREE_FORMS as readonly string[]).includes(s.look.form),
      );
    }
    // The bushes, tufts, reeds and stones stay the code's.
    for (const id of ["juniper", "willow", "heather", "reed", "stone", "myrtle", "posidonia"]) {
      expect(TREE_KINDS, id).not.toContain(id);
    }
  });

  it("have six variants each, the first the row's own tree", () => {
    for (const kind of TREE_KINDS) {
      const rows = TREE_VARIANTS[kind];
      expect(rows.length, kind).toBe(VARIANTS);
      rows.forEach((v, i) => {
        expect(v.index).toBe(i);
        expect(v.shape.form, `${kind} ${i}`).toBe(treeSpec(kind).look.form);
        expect(v.bare, `${kind} ${i}`).toBeGreaterThanOrEqual(0);
        expect(v.bare, `${kind} ${i}`).toBeLessThan(v.top);
        expect(v.spread, `${kind} ${i}`).toBeGreaterThan(0);
      });
      const first = rows[0];
      expect(first.spread, kind).toBe(1);
      expect(first.bare, kind).toBe(treeSpec(kind).look.bare);
    }
  });

  it("have a silhouette inside the unit frame, with a crown", () => {
    for (const kind of TREE_KINDS) {
      for (const v of TREE_VARIANTS[kind]) {
        let widest = 0;
        for (let i = 0; i <= 40; i++) {
          const r = crownAt(v, i / 40);
          expect(Number.isFinite(r), `${kind} ${v.index}`).toBe(true);
          expect(r, `${kind} ${v.index}`).toBeGreaterThanOrEqual(0);
          widest = Math.max(widest, r);
        }
        expect(widest, `${kind} ${v.index}`).toBeGreaterThan(0.02);
        expect(widest, `${kind} ${v.index}`).toBeLessThan(1);
      }
    }
  });

  it("stand a variant off a hash of the trunk's place, every one of them somewhere", () => {
    const seen = new Set<number>();
    for (let x = 0; x < 60; x++) seen.add(variantIndex(x * 3.7, x * -2.3));
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(variantIndex(12.5, -4)).toBe(variantIndex(12.5, -4));
    expect(variantIndex(12.5, -4, 1)).toBe(0);
  });
});

describe("a tree model's dress", () => {
  it("has two colours for every role the builder paints with", () => {
    const roles = builderRoles();
    expect(roles).toEqual(["leaf", "bark", "twig", "mark"]);
    const look = treeSpec("birch").look;
    for (const r of roles) expect(roleColours(r, look), r).not.toBeNull();
    expect(roleColours("paint", look)).toBeNull();
  });

  it("paints a vertex its role's colours off its own row, blended and shaded", () => {
    setTreeModel("alder", new Map([["v0", [part("leaf", [0.5, 1, 0])]]]));
    const g = treeModel("alder", 0)!;
    const dark = new THREE.Color(treeSpec("alder").look.leafDark).multiplyScalar(0.5);
    const col = g.getAttribute("color");
    expect(col.getX(0)).toBeCloseTo(dark.r, 5);
    expect(col.getY(0)).toBeCloseTo(dark.g, 5);
    expect(col.getZ(0)).toBeCloseTo(dark.b, 5);
  });

  it("stands a model in the unit frame: a metre tall at the reference height", () => {
    const g = treeModel("alder", 0)!;
    const pos = g.getAttribute("position");
    expect(pos.getX(1)).toBeCloseTo(1, 5);
    expect(pos.getY(1)).toBeCloseTo(5 / TREE_REFERENCE, 5);
    expect(pos.getZ(2)).toBeCloseTo(1, 5);
  });

  it("leaves a kind with no model to the code's builder", () => {
    setTreeModel("rowan", new Map());
    expect(treeModel("rowan", 0)).toBeNull();
  });
});

describe("the committed tree models", () => {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const parse = async (kind: string) => {
    const b = readFileSync(join(root, "pwa", "models", "trees", `${kind}.glb`));
    const g = await loader.parseAsync(
      b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer,
      "",
    );
    return partsOf(g);
  };

  it("decode to every variant of every kind, in both bands, in the frame, the budget and the code's outline", async () => {
    for (const kind of TREE_KINDS) {
      setTreeModel(kind, await parse(kind));
      const spec = treeSpec(kind);
      // The code's own tree, a metre tall: what a model is held against.
      const code = buildFlora(spec.look, FLORA.indexOf(spec) * 7919 + 13);
      code.computeBoundingBox();
      const cb = code.boundingBox as THREE.Box3;
      const codeWidth = Math.max(cb.max.x - cb.min.x, cb.max.z - cb.min.z);
      for (let i = 0; i < VARIANTS; i++) {
        const v = TREE_VARIANTS[kind][i];
        for (const far of [false, true]) {
          const g = treeModel(kind, i, far);
          const what = `${kind} ${i}${far ? " far" : ""}`;
          expect(g, what).not.toBeNull();
          const tris = g!.index!.count / 3;
          // The whole band's budget and the sketch's (`tree.py`).
          expect(tris, what).toBeLessThan(far ? 260 : 1400);
          expect(tris, what).toBeGreaterThan(far ? 40 : 200);
          expect(g!.getAttribute("color").count, what).toBe(g!.getAttribute("position").count);
          g!.computeBoundingBox();
          const box = g!.boundingBox as THREE.Box3;
          // Its foot in the ground, its top near the code tree's (a palm's
          // is its head, not the unit), a broken or young one's lower.
          expect(box.min.y, what).toBeLessThan(0.01);
          expect(box.max.y / (cb.max.y * v.top), what).toBeGreaterThan(0.7);
          expect(box.max.y / (cb.max.y * v.top), what).toBeLessThan(1.3);
          // And the width of the code's tree, give or take what a variant
          // departs from it by and what the modelling spreads.
          const width = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
          expect(width / (codeWidth * v.spread), what).toBeGreaterThan(0.5);
          expect(width / (codeWidth * v.spread), what).toBeLessThan(2.2);
        }
      }
    }
  });
});
