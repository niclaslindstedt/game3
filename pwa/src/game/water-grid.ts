// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE NEAR WATER'S LATTICE — where the grid's samples stand, and why they
// stand still. The sea is drawn by displacing a grid of vertices off the
// engine's `surfaceAt`, and a grid that follows the craft has a trap in it:
// if its sample points move with the craft, the wave a vertex was sampling
// is sampled somewhere else next frame, and the whole surface — every
// crest's height, every face's tint, every patch of foam — swims along with
// the rider. A grid whose cells STRETCH with distance can never be pinned:
// no one step keeps a 1.5 m cell and a 4 m cell both on their own lattice.
//
// So the near water is NESTED RINGS, each a square annulus of cells twice
// the size of the ring inside it — the geometry clipmap's layout. Every
// ring's lattice divides the coarsest ring's, so snapping the grid's origin
// to the coarsest cell puts every vertex, in every ring, on the same world
// points it stood on last frame. The craft may sit up to half a coarse cell
// off the grid's centre; the core is sized so it is always on fine water.
//
// The rings meet without cracks. Where a fine ring's outer edge runs along a
// coarse ring's inner edge, every second fine vertex has no coarse partner,
// and a coarse cell whose edge lies on that seam is drawn as three triangles
// fanned onto the fine vertex in the middle of its edge rather than as two.
// Every vertex is shared through one map from lattice point to index, so a
// seam vertex is one vertex, not two that happen to agree.
//
// Three-free and DOM-free, so `tests/water_grid_test.ts` can hold the
// layout: every vertex on its ring's lattice, every seam stitched, no
// duplicate, and a snapped origin that keeps the sample set the same.

import { type DistanceLook, type WaterLook } from "./settings-video.ts";

export type WaterGrid = {
  /** Vertices: their plan offsets from the grid's origin, m. */
  ox: Float32Array;
  oz: Float32Array;
  /** How far each vertex stands from the centre, as a share of `reach`
   * (Chebyshev), for the fade to the far water. */
  edge: Float32Array;
  /** The cell each vertex SPEAKS FOR, m — the finest ring's cell of the
   * rings that touch it. A sample is one reading of a whole cell of sea, and
   * anything that spreads a vertex's answer over the water it stands for
   * (the foam field) needs to know how much water that is. */
  step: Float32Array;
  /** Triangle indices, wound so the face normal is +y. */
  index: Uint32Array;
  /** The reach either side of the origin, m. */
  reach: number;
  /** The coarsest cell, m — what the origin snaps to. */
  snap: number;
  /** The finest cell, m. */
  cell: number;
  /** How many rings stand round the core — what `waterRings` settled on. */
  rings: number;
};

/** THE MOST RINGS ANY COMBINATION OF ROWS MAY LAY. The reach doubles per
 * ring, so a pair of rows that each ask for more would run the near water out
 * past the level itself; this is where the ladder stops. Six rings is over a
 * kilometre of near water at the design point, which is already twice the
 * furthest fog the sky can deal. */
export const MAX_RINGS = 6;

/** HOW MANY RINGS STAND ROUND THE CORE — the WATER row's own shape, plus what
 * the DISTANCE row buys.
 *
 * The reach is the one thing about the sea that belongs to DISTANCE rather
 * than to WATER: WATER says how FINE the sea is at the rider (the cell, the
 * core, the ripples, the filtering) and DISTANCE says how far the world goes.
 * A ring is the cheap way to spend that — it doubles the reach for a fixed
 * annulus of vertices, whose cells double with it — which is why the row can
 * push the drawn sea out toward the fog rather than leaving it to end in open
 * view. */
export function waterRings(look: WaterLook, distance: DistanceLook): number {
  return Math.min(MAX_RINGS, look.rings + distance.waterRings);
}

/** How far the near water reaches either side of the craft, m: the core's
 * half-width doubled once per ring. */
export function waterReach(look: WaterLook, rings: number): number {
  return (look.core / 2) * look.cell * 2 ** rings;
}

/** How many `surfaceAt` calls a frame a look costs with nothing culled —
 * the near grid's vertex count: the core's, plus each ring's annulus. */
export function waterSamples(look: WaterLook, rings: number): number {
  const n = look.core + 1;
  const inner = look.core / 2 + 1;
  return n * n + rings * (n * n - inner * inner);
}

/** Lay the rings for a look, at the ring count the two rows have agreed on
 * (`waterRings`). `core` must be a multiple of four: the core's half-width is
 * a whole number of the first ring's cells, and every ring's inner edge is a
 * whole number of its own. */
export function layWaterGrid(look: WaterLook, rings: number = look.rings): WaterGrid {
  const { cell, core } = look;
  if (core % 4 !== 0) throw new Error(`water core ${core} is not a multiple of four`);
  const reach = waterReach(look, rings);
  // Lattice units are the finest cell; a point is keyed by its lattice
  // coordinates, offset so both are non-negative.
  const span = (core / 2) * 2 ** rings;
  const width = 2 * span + 1;
  const ids = new Map<number, number>();
  const xs: number[] = [];
  const zs: number[] = [];
  // The finest cell, in lattice units, of the rings that have claimed each
  // vertex — a seam vertex is shared, and it speaks for the FINER side.
  const sts: number[] = [];
  const at = (ix: number, iz: number, st: number): number => {
    const key = (ix + span) * width + (iz + span);
    let id = ids.get(key);
    if (id === undefined) {
      id = xs.length;
      ids.set(key, id);
      xs.push(ix);
      zs.push(iz);
      sts.push(st);
    } else if (st < sts[id]) sts[id] = st;
    return id;
  };
  const index: number[] = [];
  /** One triangle, wound for a +y face normal whichever way it was named. */
  const tri = (a: number, b: number, c: number): void => {
    const cross = (xs[b] - xs[a]) * (zs[c] - zs[a]) - (zs[b] - zs[a]) * (xs[c] - xs[a]);
    if (cross > 0) index.push(a, c, b);
    else index.push(a, b, c);
  };
  for (let L = 0; L <= rings; L++) {
    const step = 2 ** L;
    const half = core / 2;
    const hole = L === 0 ? 0 : core / 4;
    for (let j = -half; j < half; j++) {
      for (let i = -half; i < half; i++) {
        if (i >= -hole && i < hole && j >= -hole && j < hole) continue;
        const x0 = i * step;
        const x1 = (i + 1) * step;
        const z0 = j * step;
        const z1 = (j + 1) * step;
        // The corners in cyclic order, and which edge (if any) lies on the
        // seam with the finer ring inside: that edge carries a fine vertex
        // at its midpoint, and the cell fans onto it.
        const corners = [at(x0, z0, step), at(x1, z0, step), at(x1, z1, step), at(x0, z1, step)];
        const inner = hole * step;
        const zIn = z0 >= -inner && z1 <= inner;
        const xIn = x0 >= -inner && x1 <= inner;
        let seam = -1;
        if (L > 0) {
          if (z0 === inner && xIn) seam = 0;
          else if (x1 === -inner && zIn) seam = 1;
          else if (z1 === -inner && xIn) seam = 2;
          else if (x0 === inner && zIn) seam = 3;
        }
        if (seam < 0) {
          tri(corners[0], corners[1], corners[2]);
          tri(corners[0], corners[2], corners[3]);
          continue;
        }
        const a = corners[seam];
        const b = corners[(seam + 1) % 4];
        const c = corners[(seam + 2) % 4];
        const d = corners[(seam + 3) % 4];
        const m = at((xs[a] + xs[b]) / 2, (zs[a] + zs[b]) / 2, step / 2);
        tri(a, m, d);
        tri(m, b, c);
        tri(m, c, d);
      }
    }
  }
  const count = xs.length;
  const ox = new Float32Array(count);
  const oz = new Float32Array(count);
  const edge = new Float32Array(count);
  const stride = new Float32Array(count);
  for (let k = 0; k < count; k++) {
    ox[k] = xs[k] * cell;
    oz[k] = zs[k] * cell;
    edge[k] = Math.max(Math.abs(ox[k]), Math.abs(oz[k])) / reach;
    stride[k] = sts[k] * cell;
  }
  return {
    ox,
    oz,
    edge,
    step: stride,
    index: new Uint32Array(index),
    reach,
    snap: cell * 2 ** rings,
    cell,
    rings,
  };
}

/** Where the grid's origin stands for a craft at `c` along one axis: the
 * nearest multiple of the coarsest cell, so every ring keeps its lattice. */
export function snapOrigin(c: number, grid: WaterGrid): number {
  return Math.round(c / grid.snap) * grid.snap;
}
