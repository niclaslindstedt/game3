// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CRAFT'S SURFACE (pwa/src/game/craft-surface.ts), held to what can be
// held without a GPU. The look is judged on the sheet and in the built app;
// what is asserted here is the CONTRACT: the surface's grafts land on the
// chunks they hook (a three upgrade that renames one would otherwise leave
// a matte craft with no error), the sky it reflects is the very bundle the
// environment writes, it is recompiled for the sheet count and nothing
// else, and the two builders write a finish on every vertex — the hull's
// gel coat and the helmet's shell polished, the grips and the vest not.
import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { CRAFT } from "@engine";

import { buildCraft, cockpitOf } from "../pwa/src/game/craft-body.ts";
import { CRAFT_STYLES } from "../pwa/src/game/craft-styles.ts";
import { FINISH, applyCraftSky, craftSurface } from "../pwa/src/game/craft-surface.ts";
import { REST_READ, poseRider } from "../pwa/src/game/rider-pose.ts";
import { createRider } from "../pwa/src/game/rider.ts";
import { createSkyUniforms } from "../pwa/src/game/sky-glsl.ts";

type Shader = {
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, THREE.IUniform>;
};

/** Run a surface's graft over three's own Phong source, the way the
 * renderer would just before compiling it. */
function compiled(material: THREE.MeshPhongMaterial): Shader {
  const shader: Shader = {
    vertexShader: THREE.ShaderLib.phong.vertexShader,
    fragmentShader: THREE.ShaderLib.phong.fragmentShader,
    uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.phong.uniforms),
  };
  material.onBeforeCompile(shader as never, null as never);
  return shader;
}

/** A finish as the attribute stores it: the buffer is single precision. */
const f32 = (finish: number): number => Math.fround(finish);

function shineOf(geometry: THREE.BufferGeometry): Float32Array {
  const attr = geometry.getAttribute("aShine") as THREE.BufferAttribute;
  expect(attr.itemSize).toBe(1);
  expect(attr.count).toBe(geometry.getAttribute("position").count);
  return attr.array as Float32Array;
}

describe("the craft's surface", () => {
  const sky = createSkyUniforms();

  it("scales the highlight by the vertex's finish", () => {
    const shader = compiled(craftSurface());
    expect(shader.vertexShader).toContain("attribute float aShine;");
    expect(shader.vertexShader).toContain("vShine = aShine;");
    expect(shader.fragmentShader).toContain("float gloss = vShine * vShine;");
    expect(shader.fragmentShader).toContain("specularStrength *= gloss;");
  });

  it("reflects the sky bundle it was given, and only then", () => {
    const studio = compiled(craftSurface());
    expect(studio.fragmentShader).not.toContain("skyAlong");
    expect(studio.uniforms).not.toHaveProperty("uSkyZenith");

    const lit = compiled(craftSurface(sky));
    expect(lit.fragmentShader).toContain("skyAlong( R, vSurfaceWorld )");
    expect(lit.fragmentShader).not.toContain("#include <envmap_fragment>");
    // Every sky uniform the source reads is carried, and carried as the
    // environment's own object rather than a copy.
    for (const m of lit.fragmentShader.matchAll(/uniform\s+\w+\s+(uSky\w+)/g)) {
      expect(lit.uniforms[m[1]], m[1]).toBe(sky[m[1]]);
    }
  });

  it("carries no sun of its own: the highlight is the sun's image", () => {
    const lit = compiled(craftSurface(sky));
    expect(lit.fragmentShader).not.toContain("uSkyDisc");
  });

  it("is recompiled for the sheet count and nothing else", () => {
    const m = craftSurface(sky);
    const key0 = m.customProgramCacheKey();
    applyCraftSky(m, 0);
    expect(m.customProgramCacheKey()).toBe(key0);
    applyCraftSky(m, 2);
    expect(m.customProgramCacheKey()).not.toBe(key0);
    expect(compiled(m).fragmentShader).toContain("k < 2");
    // A surface with no sky has one program whatever the sky does.
    const studio = craftSurface();
    const studioKey = studio.customProgramCacheKey();
    applyCraftSky(studio, 3);
    expect(studio.customProgramCacheKey()).toBe(studioKey);
    expect(studioKey).not.toBe(key0);
  });
});

describe("the finishes", () => {
  it("are on every vertex of every craft, gel coat to rubber", () => {
    for (const spec of CRAFT) {
      const surface = craftSurface();
      const body = buildCraft(spec, CRAFT_STYLES[spec.id], surface);
      const mesh = body.children[0] as THREE.Mesh;
      expect(mesh.material).toBe(surface);
      const shine = shineOf(mesh.geometry);
      let polished = 0;
      let dead = 0;
      for (const s of shine) {
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(1);
        if (s === f32(FINISH.gelcoat)) polished++;
        if (s === f32(FINISH.rubber)) dead++;
      }
      // The shell is a real share of every craft, and so is the rubber.
      expect(polished / shine.length, spec.id).toBeGreaterThan(0.15);
      expect(dead / shine.length, spec.id).toBeGreaterThan(0.05);
    }
  });

  it("put a shell on the rider's helmet and cloth on his vest", () => {
    const spec = CRAFT[0];
    const rider = createRider(cockpitOf(spec, CRAFT_STYLES[spec.id]));
    const shine = shineOf(rider.mesh.geometry);
    const values = new Set(Array.from(shine));
    expect(values.has(f32(FINISH.shell))).toBe(true);
    expect(values.has(f32(FINISH.cloth))).toBe(true);
    expect(values.has(f32(FINISH.neoprene))).toBe(true);
    rider.dispose();
  });

  it("stay with the figure when it is re-posed", () => {
    const spec = CRAFT[0];
    const cockpit = cockpitOf(spec, CRAFT_STYLES[spec.id]);
    const surface = craftSurface();
    let disposed = 0;
    surface.dispose = () => {
      disposed++;
    };
    const rider = createRider(cockpit, surface);
    expect(rider.mesh.material).toBe(surface);
    const before = Array.from(shineOf(rider.mesh.geometry));
    rider.pose(poseRider(cockpit, { ...REST_READ, aft: 0.3, throttle: 1, pace: 0.8 }));
    expect(Array.from(shineOf(rider.mesh.geometry))).toEqual(before);
    // Not his to dispose: the surface was handed in.
    rider.dispose();
    expect(disposed).toBe(0);
  });
});
