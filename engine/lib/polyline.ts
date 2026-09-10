// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HOW FAR IS THAT FROM THIS LINE — the two distance questions a polyline is
// ever asked, and nothing of this game in either of them (§23.7).
//
// They live in the pool rather than beside the course because more than one
// module in `mapgen/` needs them and those modules read each other: the
// course lays a line and asks how far the rocks are from it, and the
// circuit draws a loop and asks how far a mark is from that. Two callers
// that cannot both own it.
//
// A point here is anything with an `x` and a `z`, which is what every plan
// coordinate in the engine is.

type Point = { readonly x: number; readonly z: number };

/** Distance from a plan point to a segment. */
export function segmentDistance(
  x: number,
  z: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((x - ax) * dx + (z - az) * dz) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}

/** Distance from a plan point to a polyline. */
export function polylineDistance(points: readonly Point[], x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    const d = segmentDistance(x, z, a.x, a.z, b.x, b.z);
    if (d < best) best = d;
  }
  return best;
}
