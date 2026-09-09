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
// - THE FAR WATER is a second, coarse grid (`FAR_GRID` a side over
//   `FAR_HALF` metres, cells of tens of metres) displaced by the SAME
//   function, summing only the components long enough for its cells to
//   carry (`surfaceAt`'s `count` — the field is laid longest first): the
//   swell a storm sends in stands out to the fog, the chop that would
//   alias on a coarse cell is left off it. Under both, a flat disc to the
//   horizon. In the small seas the wind grows no component is that long,
//   the far grid sums nothing and costs nothing.
// - Over its outer fifth the near grid's height and normal fade to the FAR
//   grid's, not to flat — so the two meet without a lip whether the swell
//   under the seam is a hand's breadth or a house. The far grid has a HOLE
//   under the near grid's interior and is SUNK a little under it
//   everywhere — by more the bigger the chop it leaves out — so its coarse
//   facets never poke up through the near water and hide the hull.
// - Nothing is allocated per frame: one `SurfaceSample` is reused, the
//   attribute arrays are written in place and flagged.
//
// COLOUR is per vertex, by depth (`level.ground`, the engine's own field):
// the shallows teal, the deep dark blue, and FOAM where the surface is
// steep or the water is shallow enough to break — the breaking itself is
// the engine's clip (`TUNING.sea.breakingRatio`), and the tint reads its
// symptoms rather than restating the rule — and WHITECAPS on the crests
// once the wind is fresh enough to blow them: the top of a wave standing
// higher than most, on its steep face, in a wind past `WHITECAP_WIND`.

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

/** Where the fade to the far grid begins, as a share of `HALF`. */
const FADE_FROM = 0.78;

/** The far grid: vertices a side and its reach either side of the craft,
 * m — past the fog's end, so nothing of it pops. Its cell is `2·FAR_HALF /
 * (FAR_GRID − 1)`, and a component is drawn on it only when its deep
 * wavelength is `FAR_CELL_WAVES` cells or more. */
const FAR_GRID = 40;
const FAR_HALF = 640;
const FAR_CELL_WAVES = 3;
/** The far grid's hole: cells whose centres lie within this share of `HALF`
 * of its own centre are not drawn (the near grid is over them) — inside
 * the near grid by more than the two grids' snapping can differ. */
const FAR_HOLE = 0.82;
/** The horizon: a flat disc under both grids out to the far plane, in the
 * deep colour. `FAR_SINK` is how far under the near grid's edge the far
 * grid lies, m, plus `SHORT_SINK` times the summed amplitude of the
 * components it does not carry — the chop whose troughs it would
 * otherwise stand up through. */
const FAR_RADIUS = 4000;
const FAR_SINK = 0.35;
const SHORT_SINK = 0.7;

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
/** WHAT THE WATER REFLECTS at a grazing angle: the sky, and the LIVE one.
 * The far half of every frame over open water is reflected sky, so a
 * dramatic sky with a fixed teal sea under it is a sky that reads as
 * pasted on — a sunset has to put orange on the wave faces out toward the
 * light or it is a picture behind the game rather than in it. The
 * environment writes it (`retone`); the ladder decides it (`seaMirror`),
 * and this is only where it is kept. Its start is the palette's own high
 * sky, which is the clear noon the whole palette was authored at. */
const SKY = c(PALETTE.skyHigh);
/** A crest catches the light and a trough hides from it: the height at
 * which the crest tint is full, as a share of the sea's own significant
 * height (floored, so a calm sea still shows its ripples), and how far it
 * goes toward the shallow colour; the trough goes the same way toward the
 * deep. */
const CREST_SHARE = 0.55;
const CREST_MIN = 0.25;
const CREST_TINT = 0.45;
/** THE TILT BANDS ARE RELATIVE TO THE SEA THEY ARE READ IN. A tilt
 * (1 − n_y) of 0.09 is the surface standing at Michell's breaking
 * steepness, so as an ABSOLUTE threshold it is the right place to foam a
 * wind sea — whose crests only just reach it. But a big quoted swell is
 * steep over its whole face by construction, and an absolute band paints
 * every one of its vertices white: a twenty-metre sea comes out a
 * snowfield with a jet ski on it. So each band below is held against the
 * SEA'S OWN characteristic tilt as well — the tilt of a sinusoid of its
 * significant height at its peak wavelength — and the wider of the two
 * wins. A gentle sea is unchanged (its own tilt puts the relative band
 * back at the absolute one); a monster sea foams only where it is steep
 * FOR ITSELF. */
const FOAM_REL_FROM = 3.5;
const FOAM_REL_TO = 8;
/** WHITECAPS: the wind, m/s, they start blowing at and the wind at which
 * every crest carries one; how high a crest stands, as a share of the
 * significant height, before it caps; and the tilt band (1 − n_y) that
 * says the cap is on the steep face. */
const WHITECAP_WIND = 7;
const WHITECAP_WIND_FULL = 14;
const WHITECAP_CREST = 0.75;
const WHITECAP_TILT = 0.012;
const WHITECAP_TILT_FULL = 0.035;
/** How much of the sky the surface reflects at a full grazing angle. */
const FRESNEL = 0.75;

function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

export type WaterMesh = {
  mesh: THREE.Mesh;
  /** The far grid and the horizon disc under it. */
  far: THREE.Group;
  /** Put the sky's own colour back on the water: what a grazing wave face
   * reflects, packed sRGB. Called on a change of sky, not per frame. */
  retone: (mirror: number) => void;
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

  // THE FAR GRID: uniform cells, the same attributes, its own colour —
  // the deep mostly given over to the sky at that grazing angle, which is
  // what the near grid's own edge arrives at — so the hand-over is a
  // change of detail, not of colour.
  const farCell = (2 * FAR_HALF) / (FAR_GRID - 1);
  const farCount = FAR_GRID * FAR_GRID;
  const farPositions = new Float32Array(farCount * 3);
  const farNormals = new Float32Array(farCount * 3);
  for (let j = 0; j < FAR_GRID; j++) {
    for (let i = 0; i < FAR_GRID; i++) {
      const k = (j * FAR_GRID + i) * 3;
      farPositions[k] = -FAR_HALF + i * farCell;
      farPositions[k + 2] = -FAR_HALF + j * farCell;
      farNormals[k + 1] = 1;
    }
  }
  const farIndex: number[] = [];
  for (let j = 0; j + 1 < FAR_GRID; j++) {
    for (let i = 0; i + 1 < FAR_GRID; i++) {
      const midX = -FAR_HALF + (i + 0.5) * farCell;
      const midZ = -FAR_HALF + (j + 0.5) * farCell;
      if (Math.abs(midX) < HALF * FAR_HOLE && Math.abs(midZ) < HALF * FAR_HOLE) continue;
      const p = j * FAR_GRID + i;
      farIndex.push(p, p + FAR_GRID, p + 1, p + 1, p + FAR_GRID, p + FAR_GRID + 1);
    }
  }
  const farGeometry = new THREE.BufferGeometry();
  const farPosAttr = new THREE.BufferAttribute(farPositions, 3).setUsage(THREE.DynamicDrawUsage);
  const farNormAttr = new THREE.BufferAttribute(farNormals, 3).setUsage(THREE.DynamicDrawUsage);
  farGeometry.setAttribute("position", farPosAttr);
  farGeometry.setAttribute("normal", farNormAttr);
  farGeometry.setIndex(farIndex);
  farGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), FAR_HALF * Math.SQRT2 + 50);
  const farMaterial = new THREE.MeshPhongMaterial({
    color: DEEP.clone().lerp(SKY, 0.62),
    specular: new THREE.Color(0x1a242a),
    shininess: 120,
  });
  const farMesh = new THREE.Mesh(farGeometry, farMaterial);
  farMesh.frustumCulled = false;
  // The horizon disc under both, unlit, in the far grid's colour.
  const horizon = new THREE.Mesh(
    new THREE.CircleGeometry(FAR_RADIUS, 48),
    new THREE.MeshBasicMaterial({ color: DEEP.clone().lerp(SKY, 0.62) }),
  );
  horizon.rotation.x = -Math.PI / 2;
  horizon.position.y = -FAR_SINK;
  const far = new THREE.Group();
  far.add(farMesh, horizon);
  /** How many of the sea's components the far grid carries: the longest
   * ones, whose deep wavelength spans `FAR_CELL_WAVES` of its cells. */
  let farComponents = 0;
  let farSink = FAR_SINK;
  let farSea: GameState["sea"] | null = null;
  /** The far grid's height at a plan point, off its last displacement and
   * sunk as it stands — what the near grid's edge fades to. Bilinear over
   * the far cells. */
  const farHeightAt = (wx: number, wz: number): number => {
    const fx = clamp((wx - farMesh.position.x + FAR_HALF) / farCell, 0, FAR_GRID - 1.001);
    const fz = clamp((wz - farMesh.position.z + FAR_HALF) / farCell, 0, FAR_GRID - 1.001);
    const i0 = Math.floor(fx);
    const j0 = Math.floor(fz);
    const tx = fx - i0;
    const tz = fz - j0;
    const h = (i: number, j: number): number => farPositions[(j * FAR_GRID + i) * 3 + 1];
    return (
      (h(i0, j0) * (1 - tx) + h(i0 + 1, j0) * tx) * (1 - tz) +
      (h(i0, j0 + 1) * (1 - tx) + h(i0 + 1, j0 + 1) * tx) * tz
    );
  };

  const sample: SurfaceSample = { height: 0, nx: 0, ny: 1, nz: 0, vx: 0, vy: 0, vz: 0 };
  const long: SurfaceSample = { height: 0, nx: 0, ny: 1, nz: 0, vx: 0, vy: 0, vz: 0 };

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
    const { sea, level, t } = state;
    const ground = level.ground;
    if (sea !== farSea) {
      farSea = sea;
      farComponents = 0;
      let short = 0;
      sea.components.forEach((c, i) => {
        if (i === farComponents && (2 * Math.PI) / c.k0 >= FAR_CELL_WAVES * farCell)
          farComponents++;
        else short += c.amp;
      });
      farSink = FAR_SINK + SHORT_SINK * short;
    }
    // The far grid first, snapped to its own cells, so the near grid's
    // edge can read it.
    const fsx = Math.round(cx / farCell) * farCell;
    const fsz = Math.round(cz / farCell) * farCell;
    farMesh.position.set(fsx, 0, fsz);
    horizon.position.set(cx, -farSink - 1, cz);
    if (farComponents > 0) {
      for (let j = 0; j < FAR_GRID; j++) {
        const wz = fsz - FAR_HALF + j * farCell;
        for (let i = 0; i < FAR_GRID; i++) {
          const wx = fsx - FAR_HALF + i * farCell;
          const k = (j * FAR_GRID + i) * 3;
          surfaceAt(sea, level, wx, wz, t, sample, farComponents);
          farPositions[k + 1] = sample.height - farSink;
          farNormals[k] = sample.nx;
          farNormals[k + 1] = sample.ny;
          farNormals[k + 2] = sample.nz;
        }
      }
    } else {
      for (let k = 1; k < farPositions.length; k += 3) farPositions[k] = -farSink;
    }
    farPosAttr.needsUpdate = true;
    farNormAttr.needsUpdate = true;
    // Where the crest tint and the whitecaps stand for this sea.
    const crestHeight = Math.max(CREST_MIN, CREST_SHARE * sea.hsRef);
    // The sea's own characteristic tilt: a sinusoid of its significant
    // height at its deep-water peak wavelength, at its steepest point.
    const seaLambda = (9.81 * sea.tp * sea.tp) / (2 * Math.PI);
    const seaSlope = seaLambda > 0 ? (Math.PI * sea.hsRef) / seaLambda : 0;
    const seaTilt = 1 - 1 / Math.hypot(1, seaSlope);
    const foamFrom = Math.max(0.04, FOAM_REL_FROM * seaTilt);
    const foamTo = Math.max(0.09, FOAM_REL_TO * seaTilt);
    const capTiltFrom = Math.max(WHITECAP_TILT, FOAM_REL_FROM * seaTilt * 0.3);
    const capTiltTo = Math.max(WHITECAP_TILT_FULL, FOAM_REL_TO * seaTilt * 0.4);
    const whitecaps = clamp(
      (sea.windSpeed - WHITECAP_WIND) / (WHITECAP_WIND_FULL - WHITECAP_WIND),
      0,
      1,
    );
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
        let ny = sample.ny;
        let nx = sample.nx;
        let nz = sample.nz;
        if (fade < 1) {
          // Toward the far grid: the long components' own surface, read
          // off the far grid (sunk as it is, so the two meet exactly);
          // the short ones fade out.
          const farH = farHeightAt(wx, wz);
          positions[k + 1] = sample.height * fade + farH * (1 - fade);
          if (farComponents > 0) {
            surfaceAt(sea, level, wx, wz, t, long, farComponents);
            nx = nx * fade + long.nx * (1 - fade);
            ny = ny * fade + long.ny * (1 - fade);
            nz = nz * fade + long.nz * (1 - fade);
          } else {
            nx *= fade;
            nz *= fade;
          }
        } else positions[k + 1] = sample.height;
        // Renormalised so the lighting does not brighten toward the edge.
        const nl = 1 / Math.hypot(nx, ny, nz);
        normals[k] = nx * nl;
        normals[k + 1] = ny * nl;
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
        const crest = clamp(sample.height / crestHeight, -1, 1) * CREST_TINT;
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
        // Breaking foam on the steep and the shallow, and whitecaps on the
        // high crests' steep faces once the wind blows them.
        const cap =
          whitecaps *
          smoothstep(WHITECAP_CREST * sea.hsRef, 1.15 * sea.hsRef, sample.height) *
          smoothstep(capTiltFrom, capTiltTo, tilt);
        const foam = clamp(
          smoothstep(foamFrom, foamTo, tilt) +
            smoothstep(2.2, 0.3, depth) * smoothstep(0.012, 0.05, tilt) +
            cap * 0.8,
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

  const retone = (mirror: number): void => {
    SKY.set(mirror);
    // Both far surfaces are the same water seen at the shallowest angles
    // there are, so both are mostly sky — which is what makes each hand-over
    // (near grid → far grid → horizon) a change of DETAIL rather than of
    // colour, under any sky. The near grid needs no pass of its own: it
    // takes the sky per vertex through the Fresnel term above, off this
    // same `SKY`.
    farMaterial.color.copy(DEEP).lerp(SKY, 0.62);
    (horizon.material as THREE.MeshBasicMaterial).color.copy(DEEP).lerp(SKY, 0.62);
  };

  return {
    mesh,
    far,
    retone,
    update,
    dispose: () => {
      geometry.dispose();
      material.dispose();
      farGeometry.dispose();
      farMaterial.dispose();
      horizon.geometry.dispose();
      (horizon.material as THREE.Material).dispose();
    },
  };
}
