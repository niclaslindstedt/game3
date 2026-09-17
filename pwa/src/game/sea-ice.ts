// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SHEET, DRAWN — the winter's sea ice with the icebreaker's channel cut
// through it (R37). One mesh per chunk off the engine's own ice field
// (`Level.ice`, read through `iceAt` so the sheet stands only in the season
// the run is ridden in), the way the terrain is one mesh per chunk off the
// ground: the top of the sheet at `ICE.freeboard` where the hull grounds on
// it, and the BRASH — the rubble sloping down from the sheet's edge into
// the channel — running on under the water, so the edge is a face and not a
// line. Cells that are open water are simply not built, and the water mesh
// draws through the hole.
//
// Nothing here is a solid of its own: the engine's `bedAt` already reads the
// sheet as ground, so what is drawn is what is grounded on. Flat-shaded and
// vertex-coloured like the shore, with a hummocked top — a metre-scale
// relief off the same value noise the ground's slabs use, so the sheet
// reads as ICE rather than as a white floor — and drawn out over the skirt
// beyond the level's bounds, because the pack runs to the horizon.

import * as THREE from "three";
import { ICE, iceAt, valueNoise, hash2, type Level } from "@engine";

import { clamp } from "../lib/util.ts";

/** Chunk edge, the skirt and its cell: the terrain's own numbers, so the
 * sheet and the shore are culled and drawn to the same distances. */
const CHUNK = 256;
const SKIRT = 640;
const SKIRT_CELL = 32;

/** How far under the water the brash slope is carried at the channel's
 * edge, m: the underside of the rubble, well under the sea in the channel,
 * so the sheet never ends on the waterline where a ripple would flicker
 * through it. */
const BRASH_UNDER = 0.6;

/** The hummocks: relief on the sheet's top, m, and the period they ride at.
 * A polar sheet is nowhere level — rafted and ridged at every scale — and
 * a tenth of a metre at a hull's length is what reads as ice from the
 * saddle without lifting the ground the hull grounds on off `ICE.freeboard`
 * by more than the physics cares. */
const HUMMOCK = 0.16;
const HUMMOCK_SCALE = 14;

/** The paint: snow on the sheet, the blue of old ice in the hollows and on
 * every steep face, and the brash a broken blue-white. */
const SNOW = new THREE.Color("#eef3f7");
const BLUE = new THREE.Color("#9cc3d8");
const BRASH = new THREE.Color("#b8d4e2");
const DEEP = new THREE.Color("#6d9ab2");

const MATERIAL = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

function buildChunk(
  level: Level,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  cell: number,
): THREE.Mesh | null {
  const cols = Math.round((x1 - x0) / cell) + 1;
  const rows = Math.round((z1 - z0) / cell) + 1;
  const positions = new Float32Array(cols * rows * 3);
  const colors = new Float32Array(cols * rows * 3);
  const inside = new Uint8Array(cols * rows);
  const color = new THREE.Color();
  let any = false;
  for (let r = 0; r < rows; r++) {
    const z = z0 + r * cell;
    for (let q = 0; q < cols; q++) {
      const x = x0 + q * cell;
      const d = iceAt(level, x, z);
      const k = (r * cols + q) * 3;
      // Open water past the brash: no ice here, and no triangle over it.
      if (d < -ICE.brash) continue;
      inside[r * cols + q] = 1;
      any = true;
      let y: number;
      if (d >= 0) {
        // The sheet: its freeboard, hummocked.
        const n = valueNoise(x, z, HUMMOCK_SCALE, level.seed) - 0.5;
        y = ICE.freeboard + n * HUMMOCK;
        // Snow on the top, blue where the noise dips — the hollows are
        // where the old ice shows through — with a speckle so a slab of it
        // is not one flat white.
        color.copy(SNOW).lerp(BLUE, clamp(0.5 - n * 2.2, 0, 0.5));
        color.offsetHSL(
          0,
          0,
          (hash2(Math.round(x * 0.5), Math.round(z * 0.5), level.seed) - 0.5) * 0.05,
        );
      } else {
        // The brash: from the sheet's edge down under the water, in the
        // broken blue-white of rubble.
        const t = -d / ICE.brash;
        y = ICE.freeboard * (1 - t) - BRASH_UNDER * t;
        color.copy(BRASH).lerp(DEEP, t * 0.8);
      }
      positions[k] = x;
      positions[k + 1] = y;
      positions[k + 2] = z;
      colors[k] = color.r;
      colors[k + 1] = color.g;
      colors[k + 2] = color.b;
    }
  }
  if (!any) return null;
  const index: number[] = [];
  for (let r = 0; r + 1 < rows; r++) {
    for (let q = 0; q + 1 < cols; q++) {
      const p = r * cols + q;
      // A cell is built only when all four corners carry ice: the brash
      // band is wider than a cell, so the sheet's edge is always a strip
      // of slope and never a saw-tooth of dropped cells.
      if (!inside[p] || !inside[p + 1] || !inside[p + cols] || !inside[p + cols + 1]) continue;
      index.push(p, p + cols, p + 1, p + 1, p + cols, p + cols + 1);
    }
  }
  if (index.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return new THREE.Mesh(geometry, MATERIAL);
}

/** The whole sheet, chunked — or null on a run with no ice on it, which is
 * every run but a freezing coast's winter. */
export function createSeaIce(level: Level): THREE.Group | null {
  if (iceAt(level, level.start.x, level.start.z) === -Infinity) return null;
  const group = new THREE.Group();
  const b = level.bounds;
  const cell = level.ground.cell;
  const add = (mesh: THREE.Mesh | null): void => {
    if (mesh) group.add(mesh);
  };
  for (let z = b.minZ; z < b.maxZ; z += CHUNK) {
    for (let x = b.minX; x < b.maxX; x += CHUNK) {
      add(buildChunk(level, x, z, Math.min(x + CHUNK, b.maxX), Math.min(z + CHUNK, b.maxZ), cell));
    }
  }
  const X0 = b.minX - SKIRT;
  const X1 = b.maxX + SKIRT;
  const Z0 = b.minZ - SKIRT;
  const Z1 = b.maxZ + SKIRT;
  add(buildChunk(level, X0, Z0, X1, b.minZ, SKIRT_CELL));
  add(buildChunk(level, X0, b.maxZ, X1, Z1, SKIRT_CELL));
  add(buildChunk(level, X0, b.minZ, b.minX, b.maxZ, SKIRT_CELL));
  add(buildChunk(level, b.maxX, b.minZ, X1, b.maxZ, SKIRT_CELL));
  return group;
}

export function disposeSeaIce(group: THREE.Group): void {
  for (const child of group.children) (child as THREE.Mesh).geometry.dispose();
}
