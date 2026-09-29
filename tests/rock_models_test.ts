// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELLED ROCKS (`pwa/src/game/rock-models.ts`, made by `make blender
// KIND=rock` off `rock-variants.ts`, published packed in
// `pwa/models/rocks/`): the three kinds `rocks.ts` instances are the kinds
// modelled, four variants each; `rocks.ts` reads the code's proportions from
// the one table the models are made to; every committed kind decodes,
// through three's own loader and meshopt decoder, to all four variants in
// the UNIT frame — inside the collider's plan, its crown at or under the
// unit, its foot at the unit below — within the budget, with a shade on
// every vertex; which variant a solid is never depends on its heading; and
// a kind whose model is missing is left to the code's lump.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { describe, expect, it } from "vitest";
import type { Solid } from "@engine";

import { hasRockModel, rockModel, setRockModel } from "../pwa/src/game/rock-models.ts";
import {
  ROCK_KINDS,
  ROCK_LUMP,
  ROCK_ROWS,
  ROCK_VARIANTS,
  isRockKind,
} from "../pwa/src/game/rock-variants.ts";
import { rockVariantAt } from "../pwa/src/game/rocks.ts";
import { partsOf } from "../pwa/src/game/tree-models.ts";

const root = join(import.meta.dirname, "..");

describe("the rock kinds", () => {
  it("are the three kinds rocks.ts instances, four variants each", () => {
    expect([...ROCK_KINDS]).toEqual(["boulder", "erratic", "reef"]);
    for (const kind of ROCK_KINDS) {
      expect(isRockKind(kind)).toBe(true);
      expect(ROCK_LUMP[kind], kind).toBeDefined();
      const rows = ROCK_ROWS[kind];
      expect(rows.length, kind).toBe(ROCK_VARIANTS);
      rows.forEach((v, i) => {
        expect(v.index).toBe(i);
        expect(v.kind).toBe(kind);
        expect(v.shape.sides, `${kind} ${i}`).toBeGreaterThanOrEqual(5);
        expect(v.shape.stacks, `${kind} ${i}`).toBeGreaterThanOrEqual(3);
      });
    }
    for (const id of ["skerry", "stack", "mark"]) expect(isRockKind(id), id).toBe(false);
  });

  it("deal a variant off a solid's place, every one of them somewhere, never off its heading", () => {
    const seen = new Set<number>();
    const solid = (x: number, z: number): Solid =>
      ({ id: `s${x}`, kind: "boulder", x, z, r: 2, top: 1 }) as unknown as Solid;
    for (let i = 0; i < 80; i++) seen.add(rockVariantAt(solid(i * 17.3, i * -9.1), 38));
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
    expect(rockVariantAt(solid(120, -40), 38)).toBe(rockVariantAt(solid(120, -40), 38));
  });
});

describe("the committed rock models", () => {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const parse = async (kind: string) => {
    const b = readFileSync(join(root, "pwa", "models", "rocks", `${kind}.glb`));
    const g = await loader.parseAsync(
      b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer,
      "",
    );
    return partsOf(g);
  };

  it("decode to every variant of every kind, in the unit frame, inside the collider, within the budget", async () => {
    for (const kind of ROCK_KINDS) {
      setRockModel(kind, await parse(kind));
      expect(hasRockModel(kind), kind).toBe(true);
      for (let i = 0; i < ROCK_VARIANTS; i++) {
        const g = rockModel(kind, i);
        const what = `${kind} ${i}`;
        expect(g, what).not.toBeNull();
        const tris = g!.index!.count / 3;
        expect(tris, what).toBeLessThan(400);
        expect(tris, what).toBeGreaterThan(20);
        const col = g!.getAttribute("color");
        expect(col.count, what).toBe(g!.getAttribute("position").count);
        // Grey: a shade alone, the coast's tint is the instance's.
        expect(col.getX(0), what).toBeCloseTo(col.getY(0), 5);
        g!.computeBoundingBox();
        const box = g!.boundingBox as THREE.Box3;
        // Inside the collider across (the packer's 4 mm step allowed), its
        // foot at the unit below and its crown at or under the unit — most
        // of the way up, so a rock hung off its apex stands as tall as the
        // engine says.
        for (const v of [box.min.x, box.min.z]) expect(v, what).toBeGreaterThanOrEqual(-1.01);
        for (const v of [box.max.x, box.max.z]) expect(v, what).toBeLessThanOrEqual(1.01);
        expect(box.min.y, what).toBeLessThan(-0.55);
        expect(box.min.y, what).toBeGreaterThanOrEqual(-1.01);
        expect(box.max.y, what).toBeLessThanOrEqual(1.01);
        expect(box.max.y, what).toBeGreaterThan(0.35);
      }
    }
  });

  it("leave a kind with no model to the code's lump", () => {
    setRockModel("reef", new Map());
    expect(hasRockModel("reef")).toBe(false);
    expect(rockModel("reef", 0)).toBeNull();
  });
});
