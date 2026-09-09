// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WATER'S LIGHT, held to what can be held without a GPU. The shader
// itself is judged by looking (`make screenshots`); what is asserted here
// is the CONTRACT around it: every uniform the GLSL reads is one the
// material carries and every one the material carries is read, so a
// renamed uniform cannot leave the sea lit by a default; the sky handed to
// it is the preset's own — the glint dies behind a squall's ceiling, the
// deck's tones replace the open gradient under a lid; and the ripples' wind
// frame is a rotation, so the tile is turned and never sheared.
import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { biomeOf } from "@engine";

import { skyAt } from "../pwa/src/game/sky.ts";
import {
  applyClock,
  applySea,
  applySky,
  createWaterMaterial,
} from "../pwa/src/game/water-shader.ts";

const LAT = biomeOf("taiga").latitude;

/** The scene's two lights, set the way `environment.ts` sets them for a
 * preset — a stand-in for the environment, which owns a scene. */
function lightsFor(p: ReturnType<typeof skyAt>): {
  hemi: THREE.HemisphereLight;
  key: THREE.DirectionalLight;
} {
  const hemi = new THREE.HemisphereLight(p.hemiSky, p.hemiGround, p.hemiIntensity);
  const key = new THREE.DirectionalLight(p.sun, p.sunIntensity * (0.25 + 0.75 * p.beam));
  key.position.set(0, Math.sin(p.sunElevation), Math.cos(p.sunElevation));
  return { hemi, key };
}

describe("the water material", () => {
  const material = createWaterMaterial();
  const declared = new Set<string>();
  for (const src of [material.vertexShader, material.fragmentShader]) {
    for (const m of src.matchAll(/uniform\s+\w+\s+(\w+)\s*;/g)) declared.add(m[1]);
  }
  const carried = new Set(Object.keys(material.uniforms));
  // The fog's come from three's own chunk, and are carried through
  // `UniformsLib.fog` rather than declared in the source here.
  const FOG = ["fogColor", "fogNear", "fogFar", "fogDensity"];

  it("carries every uniform its shader reads", () => {
    for (const name of declared) expect(carried, name).toContain(name);
  });

  it("reads every uniform it carries", () => {
    for (const name of carried) {
      if (FOG.includes(name)) continue;
      expect(declared, name).toContain(name);
      // …and reads it in the body, not only in the declaration.
      const uses = material.fragmentShader.split(name).length - 1;
      expect(uses, `${name} is declared and never used`).toBeGreaterThan(1);
    }
  });

  it("is fogged and vertex-coloured, like the grids it is drawn on", () => {
    expect(material.fog).toBe(true);
    expect(material.vertexColors).toBe(true);
  });
});

describe("what the water is handed for a sky", () => {
  const material = createWaterMaterial();
  const u = material.uniforms;
  const glint = (): THREE.Color => u.uGlint.value as THREE.Color;
  const lum = (c: THREE.Color): number => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

  it("glints a clear sun and nothing behind a squall's ceiling", () => {
    const clear = skyAt(12, LAT, "clear", 0);
    const { hemi, key } = lightsFor(clear);
    applySky(material, clear, hemi, key);
    expect(lum(glint())).toBeGreaterThan(0.5);
    const squall = skyAt(12, LAT, "squall", 1);
    const lit = lightsFor(squall);
    applySky(material, squall, lit.hemi, lit.key);
    expect(lum(glint())).toBe(0);
  });

  it("reflects the ceiling under a lid and the open gradient without one", () => {
    const squall = skyAt(12, LAT, "squall", 1);
    const lit = lightsFor(squall);
    applySky(material, squall, lit.hemi, lit.key);
    if (!squall.deck) throw new Error("a squall has a deck");
    expect((u.uSkyZenith.value as THREE.Color).getHex()).toBe(squall.deck.overhead);
    expect((u.uSkyHorizon.value as THREE.Color).getHex()).toBe(squall.deck.rim);
    expect(u.uGlowStrength.value).toBe(0);
    const clear = skyAt(12, LAT, "clear", 0);
    const { hemi, key } = lightsFor(clear);
    applySky(material, clear, hemi, key);
    expect((u.uSkyZenith.value as THREE.Color).getHex()).toBe(clear.zenith);
    expect((u.uSkyHorizon.value as THREE.Color).getHex()).toBe(clear.horizon);
    expect(u.uGlowStrength.value).toBe(clear.glowStrength);
  });

  it("is lit by the lights it is handed, not by the preset", () => {
    const clear = skyAt(12, LAT, "clear", 0);
    const { hemi, key } = lightsFor(clear);
    hemi.intensity = 0.5;
    applySky(material, clear, hemi, key);
    const sky = u.uHemiSky.value as THREE.Color;
    expect(sky.r).toBeCloseTo(hemi.color.r * 0.5, 6);
    // …and the sun's direction is the key's own, unit length.
    const dir = u.uSunDir.value as THREE.Vector3;
    expect(dir.length()).toBeCloseTo(1, 6);
    expect(dir.y).toBeCloseTo(Math.sin(clear.sunElevation), 6);
  });
});

describe("what the water is handed for a sea", () => {
  const material = createWaterMaterial();
  const u = material.uniforms;

  it("turns the ripple tile downwind with a rotation, and roughens it with the wind", () => {
    for (const from of [0, 0.7, Math.PI / 2, 2.4, Math.PI]) {
      applySea(material, from, 8, 0.4);
      const r = u.uWindRot.value as THREE.Vector4;
      // Columns (r.x, r.y) and (r.z, r.w): unit and orthogonal.
      expect(Math.hypot(r.x, r.y)).toBeCloseTo(1, 6);
      expect(Math.hypot(r.z, r.w)).toBeCloseTo(1, 6);
      expect(r.x * r.z + r.y * r.w).toBeCloseTo(0, 6);
      // The downwind vector lands on the tile's v axis.
      const dx = -Math.sin(from);
      const dz = -Math.cos(from);
      const v = r.y * dx + r.w * dz;
      const across = r.x * dx + r.z * dz;
      expect(v).toBeCloseTo(1, 6);
      expect(across).toBeCloseTo(0, 6);
    }
    applySea(material, 0, 6, 0.4);
    const calm = u.uRippleStrength.value;
    applySea(material, 0, 14, 0.4);
    expect(u.uRippleStrength.value).toBeGreaterThan(calm);
    expect(u.uScatterHeight.value).toBe(0.4);
  });

  it("takes the engine's clock as it is", () => {
    applyClock(material, 12.5);
    expect(u.uTime.value).toBe(12.5);
  });
});
