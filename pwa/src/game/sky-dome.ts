// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKY, AS GEOMETRY — the three camera-locked pieces that between them
// are everything above the horizon that is not cloud:
//
//   THE DOME   a vertex-coloured sphere seen from inside: horizon at the
//              rim, zenith overhead, and a warm bleed round the sun's
//              bearing. Repainted whenever the preset moves.
//   THE DISC   the sun, a hard circle billboarded at the key light's
//              place, with a tight GLARE round it that is the core too
//              bright to look at.
//   THE HALO   the soft bloom around it, which is what actually sells a
//              low sun: the disc is small and the halo is a third of the
//              sky at sunset.
//
// ALL OF IT RIDES THE CAMERA IN ALL THREE AXES, which is what makes it a
// sky rather than a dome the rider can climb out of: from a hull thrown
// four metres up off a ramp the horizon band must still be at the eye's
// height, not four metres under it.
//
// All three are BACKDROP (sky-depth.ts) — drawn last in the opaque pass, at
// the far plane, writing no depth — so a skerry between the rider and the
// sun occludes it, and the fragments the world already covered are never
// shaded.

import * as THREE from "three";

import { SKY_ORDER, drawAsBackdrop } from "./sky-depth.ts";
import { DOME_RADIUS, skyToneAt, sunVector, type Preset } from "./sky.ts";

/** The glare round the disc: its width as a multiple of the disc's, and
 * its strength in full beam. */
const GLARE_SPREAD = 5;
const GLARE_OPACITY = 0.85;

/** The glow sprite the halo is drawn with: a radial falloff baked once into
 * a small texture. `pow` rather than a linear ramp because a linear one
 * reads as a hard-edged disc with a gradient painted on it. */
function glowTexture(): THREE.Texture {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  const mid = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x - mid, y - mid) / mid;
      const a = Math.max(0, 1 - r) ** 2.6;
      const i = (y * size + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(a * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.needsUpdate = true;
  return tex;
}

export type SkyDome = {
  /** Everything that rides the camera. Added to the scene by the caller. */
  group: THREE.Group;
  /** Repaint for a preset — the gradient, the disc, its glare, the halo.
   * Costs one pass over the dome's ~600 vertices, so it is cheap enough to
   * call on a change of sky and far too expensive to call per frame. */
  apply: (p: Preset) => void;
  /** Follow the lens. */
  update: (eyeX: number, eyeY: number, eyeZ: number) => void;
  dispose: () => void;
};

export function createSkyDome(): SkyDome {
  const group = new THREE.Group();

  // ── The dome ─────────────────────────────────────────────────────────────
  const domeGeo = new THREE.SphereGeometry(DOME_RADIUS, 32, 18);
  const domeColors = new Float32Array(domeGeo.getAttribute("position").count * 3);
  domeGeo.setAttribute("color", new THREE.BufferAttribute(domeColors, 3));
  const domeMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    fog: false,
  });
  drawAsBackdrop(domeMat);
  const dome = new THREE.Mesh(domeGeo, domeMat);
  dome.renderOrder = SKY_ORDER - 3;
  dome.frustumCulled = false;
  group.add(dome);

  const tone = new THREE.Color();

  const paintDome = (p: Preset): void => {
    const pos = domeGeo.getAttribute("position");
    const azX = Math.sin(p.sunBearing);
    const azZ = Math.cos(p.sunBearing);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const up = Math.max(0, y / DOME_RADIUS);
      // The gradient and the bleed round the sun's bearing are the sky's
      // own (`skyToneAt`), so the water reflects this same dome.
      const len = Math.hypot(x, z) || 1;
      const toward = Math.max(0, (x / len) * azX + (z / len) * azZ);
      tone.set(skyToneAt(p, up, toward));
      // Under the horizon the dome is what a rider sees past the far edge of
      // the water on a steep camera. A shade darker than the rim so the
      // waterline still reads as a line.
      if (y < 0) tone.multiplyScalar(0.9);
      domeColors[i * 3] = tone.r;
      domeColors[i * 3 + 1] = tone.g;
      domeColors[i * 3 + 2] = tone.b;
    }
    domeGeo.getAttribute("color").needsUpdate = true;
  };

  // ── The disc and its halo ────────────────────────────────────────────────
  const glowMap = glowTexture();
  const haloMat = new THREE.MeshBasicMaterial({
    map: glowMap,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  drawAsBackdrop(haloMat);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), haloMat);
  halo.renderOrder = SKY_ORDER - 1;
  halo.frustumCulled = false;
  // THE GLARE: the same glow, tight round the disc and nearly opaque — the
  // hot core the eye cannot look at. The halo is a third of the sky and
  // pale; without something between it and the disc the sun is a coin
  // pasted on a gradient, and a coin does not light a sea.
  const glareMat = new THREE.MeshBasicMaterial({
    map: glowMap,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  drawAsBackdrop(glareMat);
  const glare = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glareMat);
  glare.renderOrder = SKY_ORDER - 1;
  glare.frustumCulled = false;
  const discMat = new THREE.MeshBasicMaterial({ fog: false, transparent: true });
  drawAsBackdrop(discMat);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 24), discMat);
  disc.renderOrder = SKY_ORDER;
  disc.frustumCulled = false;
  group.add(halo, glare, disc);

  const at = new THREE.Vector3();

  const apply = (p: Preset): void => {
    paintDome(p);
    // The disc and the halo stand at the KEY's place, just inside the dome
    // so the dome's own gradient is behind them rather than fighting them
    // at the same depth.
    const v = sunVector(p.sunElevation, p.sunAzimuth);
    const r = DOME_RADIUS * 0.97;
    at.set(v.x * r, v.y * r, v.z * r);
    for (const mesh of [disc, glare, halo]) {
      mesh.position.copy(at);
      // Billboarded by facing the origin, which is the eye: the group rides
      // the camera, so the origin IS the lens.
      mesh.lookAt(0, 0, 0);
    }
    disc.scale.setScalar(Math.max(0.001, p.discSize));
    disc.visible = p.discSize > 0;
    discMat.color.set(p.disc);
    // The glare goes with the disc: four times its width, in its colour,
    // and as strong as the beam — a sun behind a sheet has a patch of
    // light in its place and no core.
    glare.scale.setScalar(Math.max(0.001, p.discSize * GLARE_SPREAD));
    glare.visible = disc.visible && p.beam > 0.01;
    glareMat.color.set(p.disc);
    glareMat.opacity = GLARE_OPACITY * p.beam;
    halo.scale.setScalar(Math.max(0.001, p.haloSize));
    halo.visible = p.haloOpacity > 0.01;
    haloMat.color.set(p.halo);
    haloMat.opacity = p.haloOpacity;
  };

  const update = (eyeX: number, eyeY: number, eyeZ: number): void => {
    group.position.set(eyeX, eyeY, eyeZ);
  };

  const dispose = (): void => {
    domeGeo.dispose();
    domeMat.dispose();
    disc.geometry.dispose();
    discMat.dispose();
    halo.geometry.dispose();
    haloMat.dispose();
    glare.geometry.dispose();
    glareMat.dispose();
    glowMap.dispose();
  };

  return { group, apply, update, dispose };
}
