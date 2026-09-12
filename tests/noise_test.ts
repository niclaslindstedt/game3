// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GENERIC NOISE POOL (engine/lib/noise.ts). `valueNoise` is held by the
// terrain and the shore that read it; what is asserted here is the one thing
// a caller cannot check by looking at its own output — that
// `tiledValueNoise` actually TILES.
//
// It matters because the failure is silent and looks like something else. A
// field sampled over a whole number of periods and wrapped anyway meets an
// unrelated field at every join, and what reaches the screen is a hard line
// every few metres of whatever the tile was drawn on — read as a pattern, a
// moiré, or a bug in the thing being textured, and never as a seam.
import { describe, expect, it } from "vitest";

import { tiledValueNoise, valueNoise } from "@engine";

describe("tiledValueNoise", () => {
  const CELLS_X = 8;
  const CELLS_Z = 5;
  const SEED = 12;
  const at = (x: number, z: number): number => tiledValueNoise(x, z, CELLS_X, CELLS_Z, SEED);

  // To float precision rather than bit for bit: the wrap is exact in the
  // LATTICE, and what drifts in the last places is the fraction inside a
  // cell once a coordinate has had a period added to it.
  it("repeats, one period on and many", () => {
    for (const [x, z] of [
      [0, 0],
      [0.37, 2.9],
      [3.5, 4.99],
      [7.9, 0.01],
    ]) {
      expect(at(x + CELLS_X, z)).toBeCloseTo(at(x, z), 12);
      expect(at(x, z + CELLS_Z)).toBeCloseTo(at(x, z), 12);
      expect(at(x + 17 * CELLS_X, z - 4 * CELLS_Z)).toBeCloseTo(at(x, z), 12);
    }
  });

  it("crosses its own edge no harder than it crosses anything else", () => {
    // A seam is a STEP, so the test is the size of the step: the jump over
    // the wrap has to sit inside the field's own step sizes rather than
    // stand out among them, which is exactly what a hard line would not do.
    const step = 1 / 64;
    let inside = 0;
    for (let x = step; x < CELLS_X - step; x += step) {
      inside = Math.max(inside, Math.abs(at(x + step, 1.3) - at(x, 1.3)));
    }
    const overTheEdge = Math.abs(at(CELLS_X, 1.3) - at(CELLS_X - step, 1.3));
    expect(overTheEdge).toBeLessThanOrEqual(inside);
  });

  it("stays in 0..1, and is the same field valueNoise draws inside one period", () => {
    for (let i = 0; i < 400; i++) {
      const v = at((i * 0.61) % CELLS_X, (i * 0.29) % CELLS_Z);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    // Away from the wrap the two agree cell for cell: the tiled reading is
    // the same lattice, so a tile is never a different-looking noise.
    for (const [x, z] of [
      [1.25, 1.75],
      [3.1, 2.4],
      [6.6, 3.8],
    ]) {
      expect(at(x, z)).toBeCloseTo(valueNoise(x, z, 1, SEED), 12);
    }
  });
});
