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
// - The grid is STRETCHED rather than uniform: `look.grid` vertices a side
//   laid on a cubic so the cells are `look.cell` metres at the craft and
//   about four times that at the edge, `look.half` metres out. Detail is
//   spent where the camera is; the far cells carry the long swell, which is
//   all that survives the distance anyway. Those three are the RIDER's — the
//   WATER row of OPTIONS ▸ VIDEO (`settings-video.ts`), because how far out
//   the sea is still a sea is the biggest CPU bill in the frame and the one
//   nothing about the GPU makes cheaper. A change of row rebuilds the mesh.
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
// COLOUR is per vertex, by depth (`level.ground`, the engine's own field) —
// and WHICH colours, and how see-through the surface is over them, is the
// COAST's (`water-optics.ts`, keyed off `level.biome`): the shallows teal,
// the deep dark blue, a crest lifted and a trough sunk;
// and a FOAM SHARE in the colour's alpha where the surface is steep or the
// water is shallow enough to break — the breaking itself is the engine's
// clip (`TUNING.sea.breakingRatio`), and the tint reads its symptoms rather
// than restating the rule — and WHITECAPS on the crests once the wind is
// fresh enough to blow them: the top of a wave standing higher than most,
// on its steep face, in a wind past `WHITECAP_WIND`. What the LIGHT does
// with all of that — the sky each face reflects, the sun's glint, the
// ripples, the foam's texture — is per pixel and `water-shader.ts`'s.

import * as THREE from "three";
import {
  BIOME_IDS,
  sampleField,
  surfaceAt,
  type BiomeId,
  type GameState,
  type SurfaceSample,
} from "@engine";

import { PALETTE } from "../identity.ts";
import { clamp } from "../lib/util.ts";
import { WATER_LOOK, type WaterLook } from "./settings-video.ts";
import { seaMirror, type Preset } from "./sky.ts";
import { seaTone, seaTones, seaWindow, waterOpticsOf, type WaterOptics } from "./water-optics.ts";
import { applyClock, applySea, applySky, createWaterMaterial } from "./water-shader.ts";

/** The grid the game is tuned on, and what the labs and the tests measure:
 * 72 × 72 = 5 184 samples a frame, six to eight milliseconds of `surfaceAt`
 * on a laptop core. The WATER row moves it either side of this
 * (`WATER_LOOK`); this is the design point it moves around. */
export const DESIGN_WATER: WaterLook = WATER_LOOK.medium;

/** Where the fade to the far grid begins, as a share of the near grid's own
 * reach. */
const FADE_FROM = 0.78;

/** The far grid: vertices a side and its reach either side of the craft,
 * m — past the fog's end, so nothing of it pops. Its cell is `2·FAR_HALF /
 * (FAR_GRID − 1)`, and a component is drawn on it only when its deep
 * wavelength is `FAR_CELL_WAVES` cells or more. */
const FAR_GRID = 40;
const FAR_HALF = 640;
const FAR_CELL_WAVES = 3;
/** The far grid's hole: cells whose centres lie within this share of the near
 * grid's reach of its own centre are not drawn (the near grid is over them) —
 * inside the near grid by more than the two grids' snapping can differ.
 *
 * It is also HOW FAR THE RIDER CAN SEE INTO THE WATER: inside that radius the
 * only water is the near grid, which is see-through, and what lies under it —
 * the sea bed, a rock's foot, a school of fish — is drawn and visible. Outside
 * it the far grid and the horizon ring are opaque water at a grazing angle,
 * which is what water actually looks like at that range, and nothing beneath
 * them shows. `WaterMesh.seeThrough` is that radius, and the one place it is
 * stated: anything drawn under the surface asks the mesh rather than
 * recomputing it, and the answer is 0 when the rider has turned the window
 * off, so one number carries both the reach and the setting. */
const FAR_HOLE = 0.82;
/** THE SEE-THROUGH ITSELF — the window's two stops and the depth scale it
 * reaches the second over — is the COAST's, not this module's:
 * `water-optics.ts`, keyed off `level.biome`. What is left here is what the
 * GRID does with it.
 *
 * HOW BRIGHT THE SEA BED IS, as a share of the water's own colour — the one
 * number an OPAQUE sea needs, and the only thing it loses by being opaque.
 *
 * With the window open the surface shows `w` of its own colour and `1 − w`
 * of whatever lies under it, and under it is a bed lit by the skylight
 * through several metres of water. That blend is most of the INSHORE sea's
 * tone: making the surface solid without accounting for it hands back a
 * pale, milky sea that reads as a different ocean rather than as a cheaper
 * one, and the foam — which was always solid — stops standing out against
 * it. So a closed window dims the body by exactly what the blend was worth,
 * `w + (1 − w)·CLOSED_BED`, and the shallows come out barely touched because
 * that is where `w` is smallest but the bed is brightest.
 *
 * Half is an eye-set figure against the same sea drawn both ways
 * (`--scene cruise --see 0` beside `--see 1`), not a measurement: the bed is
 * a lit surface with its own materials and there is no one number that is
 * right for all of them. It is deliberately short of matching — a rider who
 * turns the window off is giving up the sea as a volume, and the picture
 * says so. */
const CLOSED_BED = 0.5;
/** The horizon: a flat RING under both grids out to the far plane, in the
 * deep colour. A ring rather than a disc because the near water is
 * see-through: a disc would stand a metre under the surface right where the
 * rider is looking down through it and hide the sea bed, the rocks and
 * everything that swims. Its hole is the far grid's own, so the far grid
 * covers the gap — and it stays a ring whatever the WINDOW row says, because
 * the hole is about the two grids meeting, not about transparency.
 * `FAR_SINK` is how far under the near grid's
 * edge the far grid lies, m, plus `SHORT_SINK` times the summed amplitude
 * of the components it does not carry — the chop whose troughs it would
 * otherwise stand up through. */
const FAR_RADIUS = 4000;
const FAR_SINK = 0.35;
const SHORT_SINK = 0.7;

const c = (hex: string): THREE.Color => new THREE.Color(hex);
/** WHAT THE HORIZON DISC IS: the sky at the shallowest angle there is,
 * which is all that surface ever shows. The grids reflect the live sky
 * per pixel; the disc is too far off to be shaded and takes the one colour
 * `seaMirror` quotes. Its start is the palette's own high sky, which is
 * the clear noon the whole palette was authored at. */
const MIRROR = c(PALETTE.skyHigh);
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

function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

export type WaterMesh = {
  mesh: THREE.Mesh;
  /** The far grid and the horizon disc under it. */
  far: THREE.Group;
  /** Light the water for a sky: what the wave faces reflect, what glints,
   * and the two lights the scene has set for it. Called on a change of
   * sky, not per frame. */
  retone: (preset: Preset, hemi: THREE.HemisphereLight, key: THREE.DirectionalLight) => void;
  /** Open or close the WINDOW — whether the near water is transparent at
   * all. Applies from the next frame; the grid is not rebuilt. */
  setWindow: (open: boolean) => void;
  /** WHICH COAST'S WATER this is: its tones, its ramp, its window and its
   * clarity (`water-optics.ts`). Set before the level is drawn and before
   * `retone`, which paints the horizon out of it. */
  setCoast: (biome: BiomeId) => void;
  /** How far the rider can see INTO the water, m from the craft — 0 with the
   * window closed. Anything drawn under the surface asks this and nothing
   * else; see `FAR_HOLE`. */
  seeThrough: () => number;
  /** Re-lay the grid under the craft and displace it for the state's
   * clock. Returns the milliseconds it took — the profile's number. */
  update: (state: GameState, cx: number, cz: number) => number;
  dispose: () => void;
};

export function createWaterMesh(look: WaterLook = DESIGN_WATER): WaterMesh {
  const GRID = look.grid;
  const HALF = look.half;
  // The stretched axis: s in [-1, 1] → offset(s) = HALF·(a·s + (1−a)·s³),
  // with `a` chosen so the centre cell is `look.cell`.
  const a = (look.cell * (GRID - 1)) / (2 * HALF);
  const offsets = new Float32Array(GRID);
  for (let i = 0; i < GRID; i++) {
    const s = (i / (GRID - 1)) * 2 - 1;
    offsets[i] = HALF * (a * s + (1 - a) * s * s * s);
  }
  const count = GRID * GRID;
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  // The colour and, in its fourth channel, the foam share.
  const colors = new Float32Array(count * 4);
  // How opaque the water is straight down at each vertex — the window the
  // shader turns into an alpha once it knows the angle.
  const windows = new Float32Array(count);
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
  const colAttr = new THREE.BufferAttribute(colors, 4);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  normAttr.setUsage(THREE.DynamicDrawUsage);
  colAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", posAttr);
  geometry.setAttribute("normal", normAttr);
  geometry.setAttribute("color", colAttr);
  const winAttr = new THREE.BufferAttribute(windows, 1).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("aWindow", winAttr);
  geometry.setIndex(index);
  // The bounding sphere is the grid's own box, once: recomputing it per
  // frame would walk every vertex again for a number that never changes.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), HALF * Math.SQRT2 + 5);

  // ONE material for both grids: the light is the same light out to the
  // fog, and a seam in the shading would show where a seam in the height
  // does not.
  const material = createWaterMaterial(look);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;

  // THE FAR GRID: uniform cells, the same attributes, the deep colour and
  // no foam — at that grazing angle the shader gives nearly all of it to
  // the sky, which is what the near grid's own edge arrives at, so the
  // hand-over is a change of detail, not of colour.
  const farCell = (2 * FAR_HALF) / (FAR_GRID - 1);
  const farCount = FAR_GRID * FAR_GRID;
  const farPositions = new Float32Array(farCount * 3);
  const farNormals = new Float32Array(farCount * 3);
  const farColors = new Float32Array(farCount * 4);
  // The far water is opaque: at that range every face is grazing.
  const farWindows = new Float32Array(farCount).fill(1);
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
  const farColAttr = new THREE.BufferAttribute(farColors, 4);
  farGeometry.setAttribute("color", farColAttr);
  farGeometry.setAttribute("aWindow", new THREE.BufferAttribute(farWindows, 1));
  farGeometry.setIndex(farIndex);
  farGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), FAR_HALF * Math.SQRT2 + 50);
  const farMesh = new THREE.Mesh(farGeometry, material);
  farMesh.frustumCulled = false;
  // The horizon disc under both, unlit, in the colour the far water
  // reaches at the fog: mostly sky.
  const reach = HALF * FAR_HOLE;
  const horizon = new THREE.Mesh(
    new THREE.RingGeometry(reach, FAR_RADIUS, 48, 1),
    new THREE.MeshBasicMaterial(),
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

  /** Whether the near water is a window at all. Closed, every vertex carries
   * a full opacity and the shader's `mix(vWindow, 1, F)` is 1 at any angle,
   * so the sea is solid and everything under it is hidden by the depth test
   * rather than by a second rule. */
  let windowOpen = true;

  /** WHICH COAST'S WATER — the first built one until a level says otherwise,
   * which it does before anything is drawn. */
  let optics: WaterOptics = waterOpticsOf(BIOME_IDS[0]);
  /** One colour, rewritten per vertex: the water's body at that depth. */
  const tone = new THREE.Color();

  /** The disc is the same water seen at the shallowest angle there is, so it
   * is mostly sky — which is what makes the hand-over from the far grid a
   * change of DETAIL rather than of colour, under any sky. */
  const paintHorizon = (): void => {
    (horizon.material as THREE.MeshBasicMaterial).color
      .copy(seaTones(optics).deep)
      .lerp(MIRROR, 0.62);
  };

  const setCoast = (biome: BiomeId): void => {
    optics = waterOpticsOf(biome);
    // The far water is the deep tone whatever is under it: at that range
    // there is no bed anybody could see through it.
    const { deep } = seaTones(optics);
    for (let k = 0; k < farCount; k++) {
      farColors[k * 4] = deep.r;
      farColors[k * 4 + 1] = deep.g;
      farColors[k * 4 + 2] = deep.b;
    }
    farColAttr.needsUpdate = true;
    paintHorizon();
  };
  setCoast(BIOME_IDS[0]);

  const update = (state: GameState, cx: number, cz: number): number => {
    const t0 = performance.now();
    const sx = Math.round(cx / look.cell) * look.cell;
    const sz = Math.round(cz / look.cell) * look.cell;
    mesh.position.set(sx, 0, sz);
    const { sea, level, t } = state;
    const ground = level.ground;
    // Where the crest tint and the whitecaps stand for this sea, and the
    // coast's two end tones a crest and a trough lean toward.
    const crestHeight = Math.max(CREST_MIN, CREST_SHARE * sea.hsRef);
    const tones = seaTones(optics);
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
      applySea(material, sea.windFrom, sea.windSpeed, crestHeight);
    }
    applyClock(material, t);
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
        // Colour by depth, then foam on the steep and the shallow — the
        // tones, the ramp and the window all the COAST's.
        const depth = -sampleField(ground, wx, wz);
        seaTone(optics, depth, tone);
        let r = tone.r;
        let g = tone.g;
        let bl = tone.b;
        const w = seaWindow(optics, depth);
        if (!windowOpen) {
          const dim = w + (1 - w) * CLOSED_BED;
          r *= dim;
          g *= dim;
          bl *= dim;
        }
        // A crest lifts toward the shallow tint, a trough sinks toward the
        // deep: the wave's shape read as colour, which is most of how a
        // low sun over a small sea shows one at all.
        const crest = clamp(sample.height / crestHeight, -1, 1) * CREST_TINT;
        const toward = crest > 0 ? tones.shallow : tones.deep;
        const lift = Math.abs(crest);
        r += (toward.r - r) * lift;
        g += (toward.g - g) * lift;
        bl += (toward.b - bl) * lift;
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
        const q = (j * GRID + i) * 4;
        colors[q] = r;
        colors[q + 1] = g;
        colors[q + 2] = bl;
        colors[q + 3] = foam;
        windows[j * GRID + i] = windowOpen ? w : 1;
      }
    }
    posAttr.needsUpdate = true;
    normAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    winAttr.needsUpdate = true;
    return performance.now() - t0;
  };

  const retone = (
    preset: Preset,
    hemi: THREE.HemisphereLight,
    key: THREE.DirectionalLight,
  ): void => {
    applySky(material, preset, hemi, key);
    MIRROR.set(seaMirror(preset));
    paintHorizon();
  };

  return {
    mesh,
    far,
    retone,
    setWindow: (open) => {
      windowOpen = open;
      // Blending is switched off with it: an opaque surface drawn through the
      // transparent pass still pays for the blend and still sorts, which is
      // most of what the row was turned off to stop paying for.
      material.transparent = open;
      material.needsUpdate = true;
    },
    setCoast,
    seeThrough: () => (windowOpen ? reach : 0),
    update,
    dispose: () => {
      geometry.dispose();
      material.dispose();
      farGeometry.dispose();
      horizon.geometry.dispose();
      (horizon.material as THREE.Material).dispose();
    },
  };
}
