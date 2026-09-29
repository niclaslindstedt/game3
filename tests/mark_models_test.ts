// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELLED MARKS (`pwa/src/game/mark-models.ts`, made by `make blender
// KIND=mark` off `mark-shapes.ts`, published packed in `pwa/models/marks/`):
// the gate mark is one mesh whose primitives are the materials `gates.ts`
// dresses, the buoy is a can and a tower `buoys.ts` scales; every committed
// kind decodes, through three's own loader and meshopt decoder, in the
// code's frame — about the waterline, the lantern where the code's lantern
// is — within its budget; and a kind whose model is missing is left to the
// code's lathes.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { describe, expect, it } from "vitest";

import { markMeshes, meshesOf, setMarkModel } from "../pwa/src/game/mark-models.ts";
import { BUOY, BUOY_REFERENCE, MARK, MARK_KINDS } from "../pwa/src/game/mark-shapes.ts";

const root = join(import.meta.dirname, "..");

describe("the mark shapes", () => {
  it("state the two marks the code lathes, foot first, about the waterline", () => {
    expect([...MARK_KINDS]).toEqual(["gatemark", "buoy"]);
    for (const profile of [MARK.body, MARK.frame, MARK.lens]) {
      for (let i = 1; i < profile.length; i++) {
        expect(profile[i][1]).toBeGreaterThanOrEqual(profile[i - 1][1]);
      }
    }
    expect(MARK.body[0][1]).toBeLessThan(0);
    expect(MARK.lanternY).toBeGreaterThan(MARK.lens[0][1]);
    expect(MARK.lanternY).toBeLessThan(MARK.lens[MARK.lens.length - 1][1]);
    expect(BUOY.can.over).toBeGreaterThan(0);
    expect(BUOY_REFERENCE.top).toBeGreaterThan(BUOY.can.over + BUOY.cage.standOff);
  });
});

describe("the committed mark models", () => {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const parse = async (kind: string) => {
    const b = readFileSync(join(root, "pwa", "models", "marks", `${kind}.glb`));
    const g = await loader.parseAsync(
      b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer,
      "",
    );
    return meshesOf(g);
  };
  const box = (g: THREE.BufferGeometry): THREE.Box3 => {
    g.computeBoundingBox();
    return g.boundingBox as THREE.Box3;
  };
  const tris = (g: THREE.BufferGeometry): number =>
    (g.index?.count ?? g.getAttribute("position").count) / 3;

  it("decode the gate mark to its three materials about the waterline, the lantern where the code's is", async () => {
    setMarkModel("gatemark", await parse("gatemark"));
    const mark = markMeshes("gatemark")?.get("mark");
    expect(mark).toBeDefined();
    expect([...mark!.keys()].sort()).toEqual(["fitting", "hull", "lens"]);
    const hull = box(mark!.get("hull")!);
    // The float straddles the waterline, as wide as the code's collar.
    expect(hull.min.y).toBeLessThan(-0.5);
    expect(hull.max.x).toBeGreaterThan(0.6);
    expect(hull.max.x).toBeLessThan(0.75);
    const lens = box(mark!.get("lens")!);
    expect(lens.min.y).toBeCloseTo(MARK.lens[0][1], 1);
    expect(lens.max.y).toBeCloseTo(MARK.lens[MARK.lens.length - 1][1], 1);
    let total = 0;
    for (const g of mark!.values()) {
      expect(g.getAttribute("color").count).toBe(g.getAttribute("position").count);
      total += tris(g);
    }
    expect(total).toBeLessThan(5000);
  });

  it("decode the buoy to a can and a tower, the tower with its foot at zero", async () => {
    setMarkModel("buoy", await parse("buoy"));
    const meshes = markMeshes("buoy")!;
    expect([...meshes.keys()].sort()).toEqual(["can", "tower"]);
    const can = meshes.get("can")!;
    expect([...can.keys()].sort()).toEqual(["band", "fitting", "hull"]);
    const hull = box(can.get("hull")!);
    // A unit can: the reference radius across, the code's draft under.
    expect(hull.max.x).toBeCloseTo(1, 1);
    expect(hull.min.y).toBeCloseTo(-BUOY.can.under, 1);
    const tower = meshes.get("tower")!;
    expect([...tower.keys()].sort()).toEqual(["fitting", "lens", "tower"]);
    const legs = box(tower.get("tower")!);
    expect(legs.min.y).toBeCloseTo(0, 1);
    const foot = BUOY.can.over + BUOY.cage.standOff;
    const lens = box(tower.get("lens")!);
    // The lantern where the reference solid's `top` is, off the tower's foot.
    expect((lens.min.y + lens.max.y) / 2 + foot).toBeCloseTo(BUOY_REFERENCE.top, 1);
    let total = 0;
    for (const parts of meshes.values()) for (const g of parts.values()) total += tris(g);
    expect(total).toBeLessThan(5000);
  });

  it("leave a kind with no model to the code's lathes", () => {
    setMarkModel("buoy", new Map());
    expect(markMeshes("buoy")).toBeNull();
  });
});
