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

import { createSkyUniforms, writeSky } from "../pwa/src/game/sky-glsl.ts";
import { skyAt } from "../pwa/src/game/sky.ts";
import {
  applyClock,
  applyMirror,
  applyRain,
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
  const sky = createSkyUniforms();
  const material = createWaterMaterial(sky);
  // Compiled for the deepest stack the picture ladder offers, so the
  // assertions below cover the sheet loop rather than only the bare
  // gradient.
  const noon = skyAt(12, LAT, "clear", 0);
  const noonLights = lightsFor(noon);
  applySky(material, noon, noonLights.hemi, noonLights.key, 3);
  const declared = new Set<string>();
  for (const src of [material.vertexShader, material.fragmentShader]) {
    // …including the ARRAY ones (`uniform vec3 uBuoyPos[4];`): an array
    // uniform is a uniform, and a parser that skips them lets a whole
    // bundle be carried and never read.
    for (const m of src.matchAll(/uniform\s+\w+\s+(\w+)\s*(?:\[[^\]]*\])?\s*;/g)) {
      declared.add(m[1]);
    }
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
      // The SKY bundle is shared with the dome (sky-glsl.ts), and each of
      // the two takes the part of it its own build needs — the water carries
      // no sun, a sky with no sheets carries no layer arrays. What holds
      // there is the identity check below, not this one.
      if (name.startsWith("uSky")) continue;
      expect(declared, name).toContain(name);
      // …and reads it in the body, not only in the declaration.
      const uses = material.fragmentShader.split(name).length - 1;
      expect(uses, `${name} is declared and never used`).toBeGreaterThan(1);
    }
  });

  it("reflects the SAME sky object the dome is painted from", () => {
    // The one thing that keeps the sea from drifting off the sky over it:
    // the mirror does not get a copy of the sky's colours, it gets the very
    // uniforms `environment.ts` writes the sky into. A sky written once is
    // read twice.
    for (const name of declared) {
      if (!name.startsWith("uSky")) continue;
      expect(material.uniforms[name], name).toBe(sky[name]);
    }
    // …and it declares no sun of its own: the sun's image on the sea is the
    // glint, off the real surface normal.
    expect(declared).not.toContain("uSkyDisc");
  });

  it("is fogged and vertex-coloured, like the grids it is drawn on", () => {
    expect(material.fog).toBe(true);
    expect(material.vertexColors).toBe(true);
  });
});

describe("what the water is handed for a sky", () => {
  const sky = createSkyUniforms();
  const material = createWaterMaterial(sky);
  const u = material.uniforms;
  const glint = (): THREE.Color => u.uGlint.value as THREE.Color;
  const lum = (c: THREE.Color): number => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

  it("glints a clear sun and nothing behind a squall's ceiling", () => {
    const clear = skyAt(12, LAT, "clear", 0);
    const { hemi, key } = lightsFor(clear);
    applySky(material, clear, hemi, key, 0);
    expect(lum(glint())).toBeGreaterThan(0.5);
    const squall = skyAt(12, LAT, "squall", 1);
    const lit = lightsFor(squall);
    applySky(material, squall, lit.hemi, lit.key, 2);
    expect(lum(glint())).toBe(0);
  });

  it("reflects the ceiling under a lid and the open gradient without one", () => {
    // Written into the SHARED bundle by the environment, not by the water —
    // and the water reads that bundle, so this is the same assertion as
    // "the sea reflects the sky over it".
    const squall = skyAt(12, LAT, "squall", 1);
    writeSky(sky, squall);
    if (!squall.deck) throw new Error("a squall has a deck");
    expect((u.uSkyDeckOverhead.value as THREE.Color).getHex()).toBe(squall.deck.overhead);
    expect((u.uSkyDeckRim.value as THREE.Color).getHex()).toBe(squall.deck.rim);
    // Under a lid the sky's own horizon IS the ceiling's lit rim.
    expect((u.uSkyHorizon.value as THREE.Color).getHex()).toBe(squall.deck.rim);
    const clear = skyAt(12, LAT, "clear", 0);
    writeSky(sky, clear);
    expect((u.uSkyZenith.value as THREE.Color).getHex()).toBe(clear.zenith);
    expect((u.uSkyHorizon.value as THREE.Color).getHex()).toBe(clear.horizon);
    expect(u.uSkyGlowStrength.value).toBe(clear.glowStrength);
  });

  it("recompiles the mirror only when the stack it carries changes", () => {
    const clear = skyAt(12, LAT, "clear", 0);
    const { hemi, key } = lightsFor(clear);
    applySky(material, clear, hemi, key, 2);
    const two = material.fragmentShader;
    applySky(material, clear, hemi, key, 2);
    expect(material.fragmentShader).toBe(two);
    applySky(material, clear, hemi, key, 3);
    expect(material.fragmentShader).not.toBe(two);
  });

  it("draws no rain rings at all at the bottom DETAIL stop", () => {
    applyRain(material, 1, [9, 22]);
    expect(material.uniforms.uRainFall.value).toBe(1);
    // OFF is a reach of zero, and it takes the FALL with it — the shader's
    // whole ring loop is behind that one test, so a level under a clear sky
    // and a phone at the bottom stop both pay nothing.
    applyRain(material, 1, [0, 0]);
    expect(material.uniforms.uRainFall.value).toBe(0);
  });

  it("is lit by the lights it is handed, not by the preset", () => {
    const clear = skyAt(12, LAT, "clear", 0);
    const { hemi, key } = lightsFor(clear);
    hemi.intensity = 0.5;
    applySky(material, clear, hemi, key, 0);
    const sky = u.uHemiSky.value as THREE.Color;
    expect(sky.r).toBeCloseTo(hemi.color.r * 0.5, 6);
    // …and the sun's direction is the key's own, unit length.
    const dir = u.uSunDir.value as THREE.Vector3;
    expect(dir.length()).toBeCloseTo(1, 6);
    expect(dir.y).toBeCloseTo(Math.sin(clear.sunElevation), 6);
  });
});

describe("what the water is handed for a sea", () => {
  const material = createWaterMaterial(createSkyUniforms());
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

  it("sizes the glint's lobe by Cox and Munk's slope variance for the wind", () => {
    // σ² = 0.003 + 0.00512·U, the measured mean-square slope of a
    // wind-roughened sea — one law for the lobe and the ripple tile both.
    for (const wind of [0, 4, 12]) {
      applySea(material, 0, wind, 0.4);
      expect(u.uSlopeVar.value).toBeCloseTo(0.003 + 0.00512 * wind, 9);
    }
    // The tile carries a SHARE of it: its strength grows as the root of the
    // variance and never states a slope the lobe does not know about.
    applySea(material, 0, 0, 0.4);
    const calm = u.uRippleStrength.value;
    applySea(material, 0, 16, 0.4);
    const fresh = u.uRippleStrength.value;
    expect(fresh / calm).toBeCloseTo(Math.sqrt((0.003 + 0.00512 * 16) / 0.003), 6);
  });
});

describe("what the water is handed for a mirror", () => {
  it("holds the mirror's own objects, and shows the sky alone when it is off", () => {
    const seat = {
      texture: new THREE.Texture(),
      matrix: new THREE.Matrix4(),
      right: new THREE.Vector3(1, 0, 0),
      forward: new THREE.Vector3(0, 0, 1),
    };
    const material = createWaterMaterial(createSkyUniforms(), undefined, seat);
    const u = material.uniforms;
    // The very objects, not copies: reflection.ts writes them every frame
    // and the material is never told.
    expect(u.uMirror.value).toBe(seat.texture);
    expect(u.uMirrorMatrix.value).toBe(seat.matrix);
    expect(u.uMirrorRight.value).toBe(seat.right);
    expect(u.uMirrorForward.value).toBe(seat.forward);
    expect(u.uMirrorOn.value).toBe(0);
    applyMirror(material, true);
    expect(u.uMirrorOn.value).toBe(1);
    applyMirror(material, false);
    expect(u.uMirrorOn.value).toBe(0);
    // Built without one, the read is still defined: one transparent texel.
    const bare = createWaterMaterial(createSkyUniforms());
    expect(bare.uniforms.uMirror.value).toBeInstanceOf(THREE.DataTexture);
  });
});
