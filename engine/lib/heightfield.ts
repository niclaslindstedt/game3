// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A regular grid of heights over the plan (x, z), read back with bilinear
// interpolation. The level compiler writes two of them — the GROUND (the sea
// bed and the shore, metres against sea level) and the OFFSHORE distance
// (metres from the nearest shoreline, negative on land) — and everything
// downstream reads them through `sampleField`: the craft's buoyancy probes,
// the collision engine, the wave model's shoaling, the renderer's terrain
// mesh and the level map in scripts/. A grid rather than a closure so the
// compile step runs ONCE (OSS_GAME_SPEC §24.5) and a sample is two lerps
// rather than a stack of noise octaves at 120 Hz.
//
// Samples outside the grid clamp to the nearest edge cell: the world ends
// where the level says it does, and a probe past the edge must not read a
// hole.

export type Heightfield = {
  /** World x of column 0 and world z of row 0 (metres). */
  readonly originX: number;
  readonly originZ: number;
  /** Cell pitch in metres, the same along both axes. */
  readonly cell: number;
  readonly cols: number;
  readonly rows: number;
  /** Row-major: index = row * cols + col. */
  readonly data: Float32Array;
};

/** Allocate a zeroed field covering `cols × rows` cells from the origin. */
export function createHeightfield(
  originX: number,
  originZ: number,
  cell: number,
  cols: number,
  rows: number,
): Heightfield {
  return { originX, originZ, cell, cols, rows, data: new Float32Array(cols * rows) };
}

/** Bilinear sample at a world point, clamped to the grid's edge. */
export function sampleField(field: Heightfield, x: number, z: number): number {
  const fx = (x - field.originX) / field.cell;
  const fz = (z - field.originZ) / field.cell;
  const maxC = field.cols - 1;
  const maxR = field.rows - 1;
  const cx = fx <= 0 ? 0 : fx >= maxC ? maxC : fx;
  const cz = fz <= 0 ? 0 : fz >= maxR ? maxR : fz;
  const c0 = Math.floor(cx);
  const r0 = Math.floor(cz);
  const c1 = c0 < maxC ? c0 + 1 : c0;
  const r1 = r0 < maxR ? r0 + 1 : r0;
  const tx = cx - c0;
  const tz = cz - r0;
  const d = field.data;
  const cols = field.cols;
  const a = d[r0 * cols + c0];
  const b = d[r0 * cols + c1];
  const c = d[r1 * cols + c0];
  const e = d[r1 * cols + c1];
  return (a + (b - a) * tx) * (1 - tz) + (c + (e - c) * tx) * tz;
}

/** Central-difference slope of the field at a world point: the plan-space
 * gradient (dh/dx, dh/dz), in metres per metre. */
export function fieldGradient(field: Heightfield, x: number, z: number): { gx: number; gz: number } {
  const h = field.cell * 0.5;
  return {
    gx: (sampleField(field, x + h, z) - sampleField(field, x - h, z)) / (2 * h),
    gz: (sampleField(field, x, z + h) - sampleField(field, x, z - h)) / (2 * h),
  };
}

/** Fill every cell from a function of world position. */
export function fillField(field: Heightfield, f: (x: number, z: number) => number): void {
  for (let r = 0; r < field.rows; r++) {
    const z = field.originZ + r * field.cell;
    for (let c = 0; c < field.cols; c++) {
      field.data[r * field.cols + c] = f(field.originX + c * field.cell, z);
    }
  }
}
