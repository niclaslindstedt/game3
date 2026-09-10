// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SHORE, DRAWN. One mesh per chunk off `level.ground` — the engine's
// own heightfield, so the beach the hull grounds on is the beach that is
// drawn — coloured per vertex by `level.materialAt`: granite grey bedrock,
// the darker boulder fields, ochre sand on the beaches, and the sea bed a
// dark olive that the water tints where it shows through the shallows.
// Flat-shaded, so the low-poly facets read as slabs of rock rather than as
// a smooth blanket.
//
// AND THE BOTTOM GOES OUT WITH THE DEPTH. What hides the sea bed is not the
// surface above it — that alpha is one number for a patch of sea and knows
// nothing about how far under it a thing is, so turning it up until the bed
// is gone at twenty metres hides a fish at two by exactly as much. What hides
// it is the column of water between it and the eye, which is ITS depth: the
// bottom fades into the coast's one flat unlit bed tone over `clarity` metres
// (`water-optics.ts`) and past that has no shape left to give it away. So the
// surface can stay a window a rider reads fish through while the bottom under
// the course is simply not there — and the sea keeps the dark it always had,
// because the tone it fades into is the unlit bottom rather than the bright
// water over it.
//
// A BEACH DOES NOT STOP AT THE WATERLINE, and drawing it as if it did is
// the single loudest way a sand coast reads as a stripe painted on a rock
// one. The pale bottom under the shallows in front of a beach is what turns
// the water over it turquoise, and from out on the course that band of
// colour is most of what says "beach" at all — so a submerged vertex asks
// what the shore it runs off is made of (`shoreKindOff`) and takes the
// sand with it into the water.
//
// The grid is the level's own cell (4 m) inside the level's bounds and a
// coarser one over a SKIRT beyond them: `sampleField` clamps to the edge,
// so the land runs on flat and the sea bed keeps its depth out to where the
// fog has taken everything anyway. Without the skirt the world stops at a
// cliff a couple of hundred metres from the course.

import * as THREE from "three";
import { fieldGradient, hash2, sampleField, type Level, type Surface } from "@engine";

import { PALETTE } from "../identity.ts";
import { clamp } from "../lib/util.ts";
import { TREE_LINE } from "./flora-defs.ts";
import { seaHaze, seaTones, waterOpticsOf, type WaterOptics } from "./water-optics.ts";

/** Chunk edge, m — big enough that a frame holds a handful, small enough
 * that most of the level is culled behind the camera. */
const CHUNK = 256;
/** How far past the bounds the ground is drawn, m, and the cell it is
 * drawn at out there. */
const SKIRT = 640;
const SKIRT_CELL = 32;

const c = (hex: string): THREE.Color => new THREE.Color(hex);
const GRANITE = c(PALETTE.granite);
const BOULDER = c(PALETTE.graniteDark);
const SAND = c(PALETTE.sand);
/** Wet sand — the strip the water is still working. Sand goes DARKER and
 * browner wet, where rock goes grey, and painting both with one wet band
 * is what makes a beach look like a stone slab with sand printed on it. */
const SAND_WET = new THREE.Color(0x8f7345);
/** The bottom in front of a beach: pale, which is what the shallows over it
 * take their colour from. */
const SAND_BED = new THREE.Color(0xbda878);
/** The sea bed where the eye still reaches it: dark olive. What it goes to
 * with depth is the COAST's (`WaterOptics.bed`), and the haze below is the
 * one place the bottom darkens — there is no second ramp. */
const BED = new THREE.Color(0x3a4a34);
/** The wet band at the waterline, where the rock is darker. */
const WET = new THREE.Color(0x646a70);
/** The forest floor under the wood. Held to the same line the trees
 * themselves stop at (`flora-defs.ts`), because a shore whose paint and
 * whose trees disagree about where the wood ends is a shore with a green
 * band of nothing above its treetops. */
const FLOOR = c(PALETTE.pineDark);
/** How far out from the shore the bed still remembers what the beach in
 * front of it is made of, m. Past this the water is deep enough that its
 * own colour-by-depth is all anybody sees. */
const BED_REACH = 45;

/** What the shore a SUBMERGED point sits off is made of: one step landward
 * along the offshore field's own gradient — which points out to sea — lands
 * on the beach or the slab the bed runs off. There is no second classifier
 * for the sea bed; `materialAt` is the one answer, asked where the ground
 * is dry. */
function shoreKindOff(level: Level, x: number, z: number, offshore: number): Surface {
  const { gx, gz } = fieldGradient(level.offshore, x, z);
  const len = Math.hypot(gx, gz);
  if (len < 1e-6) return "bedrock";
  const step = offshore + 8;
  return level.materialAt(x - (gx / len) * step, z - (gz / len) * step);
}

const scratch = new THREE.Color();

/** The colour of the ground at a point, into `out`. */
function paint(
  level: Level,
  optics: WaterOptics,
  x: number,
  z: number,
  h: number,
  kind: Surface,
  out: THREE.Color,
): void {
  const offshore = sampleField(level.offshore, x, z);
  if (h < 0) {
    out.copy(BED);
    if (offshore < BED_REACH && shoreKindOff(level, x, z, offshore) === "sand") {
      // Strongest right off the beach and gone by the time the bottom is
      // out of sight, both across the shallows and down them.
      out.lerp(SAND_BED, clamp(1 + h / 3.5, 0, 1) * clamp(1 - offshore / BED_REACH, 0, 1) * 0.9);
    }
  } else if (kind === "sand") {
    out.copy(SAND).lerp(SAND_WET, clamp(1 - h / 0.7, 0, 0.85));
  } else {
    out.copy(kind === "rock" ? BOULDER : GRANITE);
    // Bedrock lightens as it climbs, boulders sit darker in the cracks.
    out.lerp(scratch.set(0xffffff), clamp(h / 40, 0, 0.18));
    // The waterline's wet band.
    out.lerp(WET, clamp(1 - h / 0.9, 0, 0.8));
    // The forest floor once the shore is behind, and only up to the tree
    // line: a boulder field stays what it is, and a hill stands bare over
    // the wood.
    if (kind === "bedrock") {
      const inland = -offshore;
      const wooded = clamp((inland - 22) / 40, 0, 0.75) * clamp((h - 1.2) / 3, 0, 1);
      out.lerp(FLOOR, wooded * clamp(1 - (h - TREE_LINE) / 8, 0, 1));
    }
  }
  // A little speckle so a flat slab is not one flat colour, and the
  // steeper the face the darker: a slab's break is in its own shadow. Sand
  // takes a fraction of it — a beach is smooth, and speckling it reads as
  // gravel.
  const n = hash2(Math.round(x * 0.25), Math.round(z * 0.25), level.seed) - 0.5;
  const { gx, gz } = fieldGradient(level.ground, x, z);
  const grain = kind === "sand" ? 0.03 : 0.09;
  out.offsetHSL(0, 0, n * grain - clamp(Math.hypot(gx, gz) * 0.25, 0, 0.14));
  // …and then the water takes it, over the depth it stands under, into the
  // coast's one flat unlit bottom tone. The speckle and the slope shading go
  // with it, which is the point: what gives a hidden bottom away is its
  // SHAPE, and one colour has none.
  if (h < 0) out.lerp(seaTones(optics).bed, seaHaze(optics, -h));
}

function buildChunk(
  level: Level,
  optics: WaterOptics,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  cell: number,
): THREE.Mesh {
  const cols = Math.round((x1 - x0) / cell) + 1;
  const rows = Math.round((z1 - z0) / cell) + 1;
  const positions = new Float32Array(cols * rows * 3);
  const colors = new Float32Array(cols * rows * 3);
  const color = new THREE.Color();
  for (let r = 0; r < rows; r++) {
    const z = z0 + r * cell;
    for (let q = 0; q < cols; q++) {
      const x = x0 + q * cell;
      const h = sampleField(level.ground, x, z);
      const k = (r * cols + q) * 3;
      positions[k] = x;
      positions[k + 1] = h;
      positions[k + 2] = z;
      paint(level, optics, x, z, h, h < 0 ? "water" : level.materialAt(x, z), color);
      colors[k] = color.r;
      colors[k + 1] = color.g;
      colors[k + 2] = color.b;
    }
  }
  const index: number[] = [];
  for (let r = 0; r + 1 < rows; r++) {
    for (let q = 0; q + 1 < cols; q++) {
      const p = r * cols + q;
      index.push(p, p + cols, p + 1, p + 1, p + cols, p + cols + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return new THREE.Mesh(geometry, TERRAIN_MATERIAL);
}

const TERRAIN_MATERIAL = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

/** The whole shore, chunked. */
export function createTerrain(level: Level): THREE.Group {
  const group = new THREE.Group();
  const b = level.bounds;
  const cell = level.ground.cell;
  const optics = waterOpticsOf(level.biome);
  // Inside the bounds, at the level's own cell.
  for (let z = b.minZ; z < b.maxZ; z += CHUNK) {
    for (let x = b.minX; x < b.maxX; x += CHUNK) {
      group.add(
        buildChunk(
          level,
          optics,
          x,
          z,
          Math.min(x + CHUNK, b.maxX),
          Math.min(z + CHUNK, b.maxZ),
          cell,
        ),
      );
    }
  }
  // The skirt: four coarse slabs around the box.
  const X0 = b.minX - SKIRT;
  const X1 = b.maxX + SKIRT;
  const Z0 = b.minZ - SKIRT;
  const Z1 = b.maxZ + SKIRT;
  group.add(buildChunk(level, optics, X0, Z0, X1, b.minZ, SKIRT_CELL));
  group.add(buildChunk(level, optics, X0, b.maxZ, X1, Z1, SKIRT_CELL));
  group.add(buildChunk(level, optics, X0, b.minZ, b.minX, b.maxZ, SKIRT_CELL));
  group.add(buildChunk(level, optics, b.maxX, b.minZ, X1, b.maxZ, SKIRT_CELL));
  return group;
}

export function disposeTerrain(group: THREE.Group): void {
  for (const child of group.children) (child as THREE.Mesh).geometry.dispose();
}
