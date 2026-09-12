// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Deterministic 2D value noise — generic math with no game knowledge.
// Everything spatial that must agree across modules (terrain shaping and
// coloring, grove placement — and, now that the landscape is driveable,
// the off-road ground the physics rides) draws from these, keyed by an
// integer seed.

/** Deterministic lattice hash in [0, 1). */
export function hash2(ix: number, iz: number, seed: number): number {
  let h = (ix * 374761393 + iz * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Hermite fade for interpolation, 0–1 → 0–1. */
export function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Bilinear value noise over a lattice of `hash2` values, period `scale` m. */
export function valueNoise(x: number, z: number, scale: number, seed: number): number {
  const gx = x / scale;
  const gz = z / scale;
  const ix = Math.floor(gx);
  const iz = Math.floor(gz);
  const fx = smooth(gx - ix);
  const fz = smooth(gz - iz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
}

/** Value noise on a TORUS: the lattice wraps after `cellsX` × `cellsZ` cells,
 * so the field repeats EXACTLY over that many cells in each axis and a tile
 * drawn from it meets itself at its own edges.
 *
 * Coordinates are in CELLS rather than metres — the caller scales, which is
 * what lets one tile carry a different period along each axis (foam streaks
 * are long downwind and short across it, so the tile they are drawn on is
 * not square). A lattice read with `valueNoise` and merely SAMPLED over a
 * whole number of periods does not tile: the hash at cell `cellsX` is not
 * the hash at cell 0, so the wrap lands on a discontinuity and every repeat
 * shows as a hard line. That is the fault this exists to close.
 */
export function tiledValueNoise(
  gx: number,
  gz: number,
  cellsX: number,
  cellsZ: number,
  seed: number,
): number {
  const ix = Math.floor(gx);
  const iz = Math.floor(gz);
  const fx = smooth(gx - ix);
  const fz = smooth(gz - iz);
  const wx0 = ((ix % cellsX) + cellsX) % cellsX;
  const wz0 = ((iz % cellsZ) + cellsZ) % cellsZ;
  const wx1 = (wx0 + 1) % cellsX;
  const wz1 = (wz0 + 1) % cellsZ;
  const a = hash2(wx0, wz0, seed);
  const b = hash2(wx1, wz0, seed);
  const c = hash2(wx0, wz1, seed);
  const d = hash2(wx1, wz1, seed);
  return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
}
