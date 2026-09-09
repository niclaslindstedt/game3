// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WATER, DRAWN. A grid that follows the craft, every vertex displaced
// each frame by the ENGINE's own `surfaceAt` — height and normal both — so
// what is drawn is exactly what the hull is riding. There is no shader
// wave: the same function the probes read at 120 Hz writes these vertices,
// and a crest the player sees is a crest the physics has.
//
// THE BUDGET is the whole design. `surfaceAt` sums eight components with a
// phase-field lookup each, about a microsecond a call, and the grid is the
// only thing in the frame that calls it thousands of times. So:
//
// - The grid is STRETCHED rather than uniform: `GRID` vertices a side laid
//   on a cubic so the cells are `CENTRE_CELL` metres at the craft and about
//   four times that at the edge, `HALF` metres out. Detail is spent where
//   the camera is; the far cells carry the long swell, which is all that
//   survives the distance anyway.
// - The grid SNAPS to whole centre cells as it follows the craft, so the
//   sample points do not swim under the surface between frames.
// - The height and the normal fade to flat over the outer fifth, so the
//   grid meets the far disc (`far`) without a lip.
// - Nothing is allocated per frame: one `SurfaceSample` is reused, the
//   attribute arrays are written in place and flagged.
//
// COLOUR is per vertex, by depth (`level.ground`, the engine's own field):
// the shallows teal, the deep dark blue, and FOAM where the surface is
// steep or the water is shallow enough to break — the breaking itself is
// the engine's clip (`TUNING.sea.breakingRatio`), and the tint reads its
// symptoms rather than restating the rule.

import * as THREE from "three";
import { sampleField, surfaceAt, type GameState, type SurfaceSample } from "@engine";

import { PALETTE } from "../identity.ts";
import { clamp } from "../lib/util.ts";

/** Vertices a side, the grid's reach either side of the craft, m, and the
 * cell at its centre, m. 72 × 72 = 5 184 samples a frame, six to eight
 * milliseconds of `surfaceAt` on a laptop core — the most the water may
 * spend and still leave a 60 Hz frame room for everything else. */
export const GRID = 72;
export const HALF = 120;
export const CENTRE_CELL = 1.5;

/** Where the fade to flat begins, as a share of `HALF`. */
const FADE_FROM = 0.78;

/** The far water: a flat disc under the grid out to the horizon, in the
 * deep colour, sunk a little so the grid's flattened edge always lies over
 * it rather than fighting it. */
const FAR_RADIUS = 4000;
const FAR_SINK = 0.35;

/** Depth at which the shallow tint has given way to the sea's own colour,
 * m, and where that has given way to the deep. */
const SHALLOW_TO = 4;
const DEEP_FROM = 4;
const DEEP_TO = 22;

const c = (hex: string): THREE.Color => new THREE.Color(hex);
const SHALLOW = c(PALETTE.seaShallow);
const SEA = c(PALETTE.sea);
const DEEP = c(PALETTE.seaDeep);
const FOAM = c(PALETTE.foam);
/** What the water reflects at a grazing angle: the sky. */
const SKY = c(PALETTE.skyHigh);
/** A crest catches the light and a trough hides from it: the height, m,
 * at which the crest tint is full, and how far it goes toward the shallow
 * colour; the trough goes the same way toward the deep. */
const CREST_HEIGHT = 0.3;
const CREST_TINT = 0.45;
/** How much of the sky the surface reflects at a full grazing angle. */
const FRESNEL = 0.75;

function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

export type WaterMesh = {
  mesh: THREE.Mesh;
  far: THREE.Mesh;
  /** Re-lay the grid under the craft and displace it for the state's
   * clock; `eye` is where the lens is, for the reflection's angle.
   * Returns the milliseconds it took — the profile's number. */
  update: (
    state: GameState,
    cx: number,
    cz: number,
    eyeX: number,
    eyeY: number,
    eyeZ: number,
  ) => number;
  dispose: () => void;
};

export function createWaterMesh(): WaterMesh {
  // The stretched axis: s in [-1, 1] → offset(s) = HALF·(a·s + (1−a)·s³),
  // with `a` chosen so the centre cell is CENTRE_CELL.
  const a = (CENTRE_CELL * (GRID - 1)) / (2 * HALF);
  const offsets = new Float32Array(GRID);
  for (let i = 0; i < GRID; i++) {
    const s = (i / (GRID - 1)) * 2 - 1;
    offsets[i] = HALF * (a * s + (1 - a) * s * s * s);
  }
  const count = GRID * GRID;
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const k = (j * GRID + i) * 3;
      positions[k] = offsets[i];
      positions[k + 2] = offsets[j];
      normals[k + 1] = 1;
    }
  }
  const index: number[] = [];
  for (let j = 0; j + 1 < GRID; j++) {
    for (let i = 0; i + 1 < GRID; i++) {
      const p = j * GRID + i;
      // Wound so the face normal is +y (three's front face is CCW).
      index.push(p, p + GRID, p + 1, p + 1, p + GRID, p + GRID + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3);
  const normAttr = new THREE.BufferAttribute(normals, 3);
  const colAttr = new THREE.BufferAttribute(colors, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  normAttr.setUsage(THREE.DynamicDrawUsage);
  colAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", posAttr);
  geometry.setAttribute("normal", normAttr);
  geometry.setAttribute("color", colAttr);
  geometry.setIndex(index);
  // The bounding sphere is the grid's own box, once: recomputing it per
  // frame would walk every vertex again for a number that never changes.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), HALF * Math.SQRT2 + 5);

  // A tight glint rather than a wash: with the sun low over a nearly flat
  // sea, a broad highlight lights half the frame white.
  const material = new THREE.MeshPhongMaterial({
    vertexColors: true,
    specular: new THREE.Color(0x2c3a42),
    shininess: 200,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;

  // Unlit, in the colour the grid's own edge has arrived at — the deep
  // mostly given over to the sky at that grazing angle — so the hand-over
  // from the grid is a change of detail, not of colour.
  const far = new THREE.Mesh(
    new THREE.CircleGeometry(FAR_RADIUS, 48),
    new THREE.MeshBasicMaterial({ color: DEEP.clone().lerp(SKY, 0.62) }),
  );
  far.rotation.x = -Math.PI / 2;
  far.position.y = -FAR_SINK;

  const sample: SurfaceSample = { height: 0, nx: 0, ny: 1, nz: 0, vx: 0, vy: 0, vz: 0 };

  const update = (
    state: GameState,
    cx: number,
    cz: number,
    eyeX: number,
    eyeY: number,
    eyeZ: number,
  ): number => {
    const t0 = performance.now();
    const sx = Math.round(cx / CENTRE_CELL) * CENTRE_CELL;
    const sz = Math.round(cz / CENTRE_CELL) * CENTRE_CELL;
    mesh.position.set(sx, 0, sz);
    far.position.set(cx, -FAR_SINK, cz);
    const { sea, level, t } = state;
    const ground = level.ground;
    for (let j = 0; j < GRID; j++) {
      const oz = offsets[j];
      const wz = sz + oz;
      const fz = Math.abs(oz) / HALF;
      for (let i = 0; i < GRID; i++) {
        const ox = offsets[i];
        const wx = sx + ox;
        const k = (j * GRID + i) * 3;
        surfaceAt(sea, level, wx, wz, t, sample);
        const edge = Math.max(fz, Math.abs(ox) / HALF);
        const fade = 1 - smoothstep(FADE_FROM, 1, edge);
        positions[k + 1] = sample.height * fade;
        // The normal flattens with the height; renormalised so the
        // lighting does not brighten toward the edge.
        const nx = sample.nx * fade;
        const nz = sample.nz * fade;
        const nl = 1 / Math.hypot(nx, sample.ny, nz);
        normals[k] = nx * nl;
        normals[k + 1] = sample.ny * nl;
        normals[k + 2] = nz * nl;
        // Colour by depth, then foam on the steep and the shallow.
        const depth = -sampleField(ground, wx, wz);
        const shallow = clamp(depth / SHALLOW_TO, 0, 1);
        const deep = clamp((depth - DEEP_FROM) / (DEEP_TO - DEEP_FROM), 0, 1);
        let r = SHALLOW.r + (SEA.r - SHALLOW.r) * shallow;
        let g = SHALLOW.g + (SEA.g - SHALLOW.g) * shallow;
        let bl = SHALLOW.b + (SEA.b - SHALLOW.b) * shallow;
        r += (DEEP.r - r) * deep;
        g += (DEEP.g - g) * deep;
        bl += (DEEP.b - bl) * deep;
        // A crest lifts toward the shallow tint, a trough sinks toward the
        // deep: the wave's shape read as colour, which is most of how a
        // low sun over a small sea shows one at all.
        const crest = clamp(sample.height / CREST_HEIGHT, -1, 1) * CREST_TINT;
        if (crest > 0) {
          r += (SHALLOW.r - r) * crest;
          g += (SHALLOW.g - g) * crest;
          bl += (SHALLOW.b - bl) * crest;
        } else {
          r += (DEEP.r - r) * -crest;
          g += (DEEP.g - g) * -crest;
          bl += (DEEP.b - bl) * -crest;
        }
        // The sky, reflected at a grazing angle (Schlick's Fresnel on the
        // vertex): the water goes pale toward the horizon and stays its
        // own colour under the lens, and a wave face turned toward the
        // lens goes darker than the back turned away.
        const dx = eyeX - wx;
        const dy = eyeY - positions[k + 1];
        const dz = eyeZ - wz;
        const dl = 1 / Math.max(1e-3, Math.hypot(dx, dy, dz));
        const cosV = Math.max(
          0,
          (dx * normals[k] + dy * normals[k + 1] + dz * normals[k + 2]) * dl,
        );
        const grazing = (1 - cosV) ** 4 * FRESNEL;
        r += (SKY.r - r) * grazing;
        g += (SKY.g - g) * grazing;
        bl += (SKY.b - bl) * grazing;
        const tilt = 1 - sample.ny;
        const foam = clamp(
          smoothstep(0.04, 0.09, tilt) +
            smoothstep(2.2, 0.3, depth) * smoothstep(0.012, 0.05, tilt),
          0,
          1,
        );
        colors[k] = r + (FOAM.r - r) * foam;
        colors[k + 1] = g + (FOAM.g - g) * foam;
        colors[k + 2] = bl + (FOAM.b - bl) * foam;
      }
    }
    posAttr.needsUpdate = true;
    normAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    return performance.now() - t0;
  };

  return {
    mesh,
    far,
    update,
    dispose: () => {
      geometry.dispose();
      material.dispose();
      far.geometry.dispose();
      (far.material as THREE.Material).dispose();
    },
  };
}
