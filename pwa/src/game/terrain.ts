// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SHORE, DRAWN. One mesh per chunk off `level.ground` — the engine's
// own heightfield, so the beach the hull grounds on is the beach that is
// drawn — coloured per vertex by `level.materialAt`: granite grey bedrock,
// the darker boulder fields, ochre sand in the pockets, and the sea bed a
// dark olive that the water tints where it shows through the shallows.
// Flat-shaded, so the low-poly facets read as slabs of rock rather than as
// a smooth blanket.
//
// The grid is the level's own cell (4 m) inside the level's bounds and a
// coarser one over a SKIRT beyond them: `sampleField` clamps to the edge,
// so the land runs on flat and the sea bed keeps its depth out to where the
// fog has taken everything anyway. Without the skirt the world stops at a
// cliff a couple of hundred metres from the course.

import * as THREE from "three";
import { hash2, sampleField, type Level, type Surface } from "@engine";

import { PALETTE } from "../identity.ts";
import { clamp } from "../lib/util.ts";

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
/** The sea bed: dark olive, going to near-black by the deep. */
const BED = new THREE.Color(0x3a4a34);
const BED_DEEP = new THREE.Color(0x14241c);
/** The wet band at the waterline, where the rock is darker. */
const WET = new THREE.Color(0x646a70);
/** The tree line inland: the forest floor under the pines. */
const FLOOR = c(PALETTE.pineDark);

const scratch = new THREE.Color();

/** The colour of the ground at a point, into `out`. */
function paint(level: Level, x: number, z: number, h: number, kind: Surface, out: THREE.Color): void {
  if (h < 0) {
    out.copy(BED).lerp(BED_DEEP, clamp(-h / 14, 0, 1));
  } else {
    if (kind === "sand") out.copy(SAND);
    else if (kind === "rock") out.copy(BOULDER);
    else out.copy(GRANITE);
    // Bedrock lightens as it climbs, boulders sit darker in the cracks.
    out.lerp(scratch.set(0xffffff), clamp(h / 40, 0, 0.18));
    // The waterline's wet band.
    out.lerp(WET, clamp(1 - h / 0.9, 0, 0.8));
    // The forest floor once the shore is behind: only the bedrock gives
    // way to it, a boulder field or a sand pocket stays what it is.
    if (kind === "bedrock") {
      const inland = -sampleField(level.offshore, x, z);
      out.lerp(FLOOR, clamp((inland - 22) / 40, 0, 0.75) * clamp((h - 1.2) / 3, 0, 1));
    }
  }
  // A little speckle so a flat slab is not one flat colour.
  const n = hash2(Math.round(x * 0.25), Math.round(z * 0.25), level.seed) - 0.5;
  out.offsetHSL(0, 0, n * 0.06);
}

function buildChunk(level: Level, x0: number, z0: number, x1: number, z1: number, cell: number): THREE.Mesh {
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
      paint(level, x, z, h, h < 0 ? "water" : level.materialAt(x, z), color);
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
  // Inside the bounds, at the level's own cell.
  for (let z = b.minZ; z < b.maxZ; z += CHUNK) {
    for (let x = b.minX; x < b.maxX; x += CHUNK) {
      group.add(buildChunk(level, x, z, Math.min(x + CHUNK, b.maxX), Math.min(z + CHUNK, b.maxZ), cell));
    }
  }
  // The skirt: four coarse slabs around the box.
  const X0 = b.minX - SKIRT;
  const X1 = b.maxX + SKIRT;
  const Z0 = b.minZ - SKIRT;
  const Z1 = b.maxZ + SKIRT;
  group.add(buildChunk(level, X0, Z0, X1, b.minZ, SKIRT_CELL));
  group.add(buildChunk(level, X0, b.maxZ, X1, Z1, SKIRT_CELL));
  group.add(buildChunk(level, X0, b.minZ, b.minX, b.maxZ, SKIRT_CELL));
  group.add(buildChunk(level, b.maxX, b.minZ, X1, b.maxZ, SKIRT_CELL));
  return group;
}

export function disposeTerrain(group: THREE.Group): void {
  for (const child of group.children) (child as THREE.Mesh).geometry.dispose();
}
