// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELLED BIRDS (`pwa/src/game/bird-models.ts`, made by `make blender
// KIND=bird` off `bird-defs.ts` and `bird-wing.ts`, published packed in
// `pwa/models/birds/`): every species of the roster is modelled; the code's
// builder reads its wing numbers from the one table the models are made
// to; every role the builder paints a face with is one the game dresses;
// and every committed species decodes, through three's own loader and
// meshopt decoder, in the code's frame — the shoulders at the origin, the
// bill forward, the wings level and as wide as the row's span, every wing
// vertex flagged for the shader — within the budget.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { describe, expect, it } from "vitest";

import { BIRDS, BIRD_IDS } from "../pwa/src/game/bird-defs.ts";
import { birdModel, hasBirdModel, setBirdModel } from "../pwa/src/game/bird-models.ts";
import { BIRD_STYLES } from "../pwa/src/game/bird-shapes.ts";
import { BIRD_ROLES, WING, roleColour, wingEdges } from "../pwa/src/game/bird-wing.ts";
import { partsOf } from "../pwa/src/game/tree-models.ts";

const root = join(import.meta.dirname, "..");

/** The roles `bird.py` paints with, read off its text. */
function builderRoles(): string[] {
  const src = readFileSync(join(root, "scripts", "blender", "bird.py"), "utf8");
  const m = /^ROLES = \(([^)]*)\)/m.exec(src);
  if (!m) throw new Error("bird.py states no ROLES");
  return [...m[1].matchAll(/"(\w+)"/g)].map((x) => x[1]);
}

describe("the bird's wing and roles", () => {
  it("state the wing the code builds, its stations along the half-span", () => {
    expect(WING.stations[0]).toBeGreaterThan(0);
    expect(WING.stations[WING.stations.length - 1]).toBe(1);
    expect(WING.tipFrom).toBeLessThan(1);
    const gull = BIRDS.find((b) => b.id === "gull")!;
    const rootEdge = wingEdges(gull, 0);
    const tip = wingEdges(gull, 1);
    expect(rootEdge.lead - rootEdge.trail).toBeGreaterThan(tip.lead - tip.trail);
  });

  it("paint with the roles the game dresses, every one coloured off a style", () => {
    expect(builderRoles()).toEqual([...BIRD_ROLES]);
    for (const id of BIRD_IDS) {
      const style = BIRD_STYLES[id];
      for (const role of BIRD_ROLES) {
        const hex = roleColour(role, style);
        if (role === "legs") expect(hex === null, id).toBe(style.legs === undefined);
        else expect(hex, `${id} ${role}`).not.toBeNull();
      }
    }
    expect(roleColour("paint", BIRD_STYLES.gull)).toBeNull();
  });
});

describe("the committed bird models", () => {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const parse = async (id: string) => {
    const b = readFileSync(join(root, "pwa", "models", "birds", `${id}.glb`));
    const g = await loader.parseAsync(
      b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer,
      "",
    );
    return partsOf(g, /^bird$/).get("bird") ?? [];
  };

  it("decode every species in the code's frame, wings level and as wide as the row, every wing vertex flagged", async () => {
    for (const spec of BIRDS) {
      setBirdModel(spec.id, await parse(spec.id));
      expect(hasBirdModel(spec.id), spec.id).toBe(true);
      const g = birdModel(spec.id)!;
      expect(g, spec.id).not.toBeNull();
      const tris = g.index!.count / 3;
      expect(tris, spec.id).toBeLessThan(900);
      expect(tris, spec.id).toBeGreaterThan(150);
      const pos = g.getAttribute("position");
      const wing = g.getAttribute("aWing");
      expect(wing.count, spec.id).toBe(pos.count);
      g.computeBoundingBox();
      const box = g.boundingBox as THREE.Box3;
      // As wide as the span (the packer's step allowed), the bill ahead of
      // the shoulders about where the row says, the tail behind.
      expect(box.max.x, spec.id).toBeCloseTo(spec.span / 2, 1);
      expect(box.min.x, spec.id).toBeCloseTo(-spec.span / 2, 1);
      expect(box.max.z, spec.id).toBeGreaterThan(spec.length * spec.neck * 0.8);
      expect(box.min.z, spec.id).toBeLessThan(-spec.length * (1 - spec.neck) * 0.8);
      // The wings level: every flagged vertex within a hand of y = 0, and
      // the wing is most of the mesh.
      let wings = 0;
      let flat = true;
      for (let i = 0; i < pos.count; i++) {
        if (wing.getX(i) < 0.5) continue;
        wings++;
        if (Math.abs(pos.getY(i)) > 0.06 * spec.span) flat = false;
      }
      expect(flat, `${spec.id}: a wing vertex off the level`).toBe(true);
      expect(wings / pos.count, spec.id).toBeGreaterThan(0.2);
      // Dressed: a colour on every vertex.
      expect(g.getAttribute("color").count, spec.id).toBe(pos.count);
    }
  });

  it("leave a species with no model to the code's builder", () => {
    setBirdModel("gull", []);
    expect(hasBirdModel("gull")).toBe(false);
    expect(birdModel("gull")).toBeNull();
  });
});
