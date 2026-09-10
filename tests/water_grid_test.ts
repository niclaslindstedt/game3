// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE NEAR WATER'S LATTICE (water-grid.ts), held without a GPU: the rings
// are laid on one lattice, the seams between them are stitched without a
// crack, no vertex is stated twice, every face is wound the same way up,
// and the snap that follows the craft keeps every vertex on the world point
// it sampled last frame — which is the whole reason the rings exist.
import { describe, expect, it } from "vitest";

import { WATER_LOOK } from "../pwa/src/game/settings-video.ts";
import {
  layWaterGrid,
  snapOrigin,
  waterReach,
  waterSamples,
  type WaterGrid,
} from "../pwa/src/game/water-grid.ts";

/** Every undirected edge of the mesh, keyed low index first, with how many
 * faces share it. */
function edgeCounts(grid: WaterGrid): Map<string, number> {
  const counts = new Map<string, number>();
  const idx = grid.index;
  for (let f = 0; f < idx.length; f += 3) {
    for (let e = 0; e < 3; e++) {
      const a = idx[f + e];
      const b = idx[f + ((e + 1) % 3)];
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

describe("the water grid", () => {
  const looks = Object.values(WATER_LOOK);

  it("counts and reaches what settings-video promises", () => {
    for (const look of looks) {
      const grid = layWaterGrid(look);
      expect(grid.ox.length).toBe(waterSamples(look));
      expect(grid.reach).toBe(waterReach(look));
      let far = 0;
      for (let k = 0; k < grid.ox.length; k++) {
        far = Math.max(far, Math.abs(grid.ox[k]), Math.abs(grid.oz[k]));
      }
      expect(far).toBeCloseTo(grid.reach, 3);
    }
  });

  it("states every vertex once, on its lattice", () => {
    for (const look of looks) {
      const grid = layWaterGrid(look);
      const seen = new Set<string>();
      for (let k = 0; k < grid.ox.length; k++) {
        const ix = grid.ox[k] / look.cell;
        const iz = grid.oz[k] / look.cell;
        expect(Math.abs(ix - Math.round(ix))).toBeLessThan(1e-4);
        expect(Math.abs(iz - Math.round(iz))).toBeLessThan(1e-4);
        const key = `${Math.round(ix)},${Math.round(iz)}`;
        expect(seen.has(key), `vertex ${key} twice`).toBe(false);
        seen.add(key);
      }
    }
  });

  it("is a closed sheet: every interior edge is shared by exactly two faces", () => {
    // A crack at a ring's seam is an edge with one face on it that is not on
    // the outer rim; a fold is an edge with three.
    for (const look of looks) {
      const grid = layWaterGrid(look);
      const counts = edgeCounts(grid);
      const rim = (k: number): boolean =>
        Math.abs(Math.abs(grid.ox[k]) - grid.reach) < 1e-4 ||
        Math.abs(Math.abs(grid.oz[k]) - grid.reach) < 1e-4;
      for (const [key, n] of counts) {
        const [a, b] = key.split("-").map(Number);
        expect(n, `edge ${key}`).toBeLessThanOrEqual(2);
        if (n === 1) expect(rim(a) && rim(b), `edge ${key} is open`).toBe(true);
      }
    }
  });

  it("winds every face upward", () => {
    for (const look of looks) {
      const grid = layWaterGrid(look);
      const idx = grid.index;
      for (let f = 0; f < idx.length; f += 3) {
        const a = idx[f];
        const b = idx[f + 1];
        const c = idx[f + 2];
        // (b − a) × (c − a) in the plane, y component: positive is +y under
        // three's counter-clockwise front face.
        const y =
          (grid.oz[b] - grid.oz[a]) * (grid.ox[c] - grid.ox[a]) -
          (grid.ox[b] - grid.ox[a]) * (grid.oz[c] - grid.oz[a]);
        expect(y).toBeGreaterThan(0);
      }
    }
  });

  it("keeps every vertex on the same world points as the craft moves", () => {
    // The origin snaps to the coarsest cell, so any two origins differ by a
    // multiple of every ring's cell — a vertex's world position is always a
    // point of its ring's lattice, and the set of sampled points is the same
    // set shifted by whole coarse cells.
    for (const look of looks) {
      const grid = layWaterGrid(look);
      for (const c of [0, 3.7, 11.2, 100.4, -57.9]) {
        const o = snapOrigin(c, grid);
        expect(Math.abs(o / grid.snap - Math.round(o / grid.snap))).toBeLessThan(1e-9);
        expect(Math.abs(o - c)).toBeLessThanOrEqual(grid.snap / 2 + 1e-9);
      }
      for (let k = 0; k < grid.ox.length; k++) {
        // The finest ring this vertex lies on — a seam vertex is the finer
        // ring's — and that ring's cell.
        const d = Math.max(Math.abs(grid.ox[k]), Math.abs(grid.oz[k]));
        let half = (look.core / 2) * look.cell;
        let cell = look.cell;
        while (d > half + 1e-4) {
          half *= 2;
          cell *= 2;
        }
        expect(Math.abs(grid.ox[k] / cell - Math.round(grid.ox[k] / cell))).toBeLessThan(1e-4);
        expect(Math.abs(grid.oz[k] / cell - Math.round(grid.oz[k] / cell))).toBeLessThan(1e-4);
      }
    }
  });
});
