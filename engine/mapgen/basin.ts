// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R15 — THE WATER, carved around the route, and the OFFSHORE field the whole
// engine reads it through.
//
// The route (R24) says where the race goes; this says what water it goes
// through. Three things are unioned and one is cut out of them:
//
//   THE CORRIDOR   water within the route's own half-width of the line, so
//                  every metre of the race has water under it by
//                  construction. The half-width swells and closes along the
//                  line, which is what makes a bay a bay and a channel a
//                  channel.
//   THE OPEN SEA   everything seaward of a straight sea line. This is what
//                  keeps the game a SEA game: the wave model reads
//                  `offshore` as fetch, and a lagoon with land all round it
//                  has no fetch anywhere and therefore no waves. The route
//                  is drawn to spend part of its length out here and part
//                  up the channels, so a run goes from open water into the
//                  land and back out.
//   THE ISLANDS    blobs cut back OUT of the water, standing clear of the
//                  route by `island.clear` — the rock the course goes round
//                  rather than past.
//
// What comes out is one signed field: metres from the water's edge,
// positive in the water and negative on land. That is exactly what
// `Level.offshore` has always been, so everything downstream — the bed
// profile, the land's step, the fetch the sea is built from, R1's band —
// reads it unchanged. The coastline is wherever it crosses zero, and it is
// no longer a single-valued function of anything: an inlet doubles back on
// itself and an island is a coastline with no ends, both of which the old
// base-line frame could not express at all.
//
// BAKED, NOT SOLVED. The field is stamped into the grid once: every sample
// of the route pushes its own distance into the cells around it, nearer
// wins, and the sea and the islands are folded in per cell afterwards. A
// nearest-segment query per cell would be the cost of building a level —
// two hundred segments against three hundred thousand cells — and this is
// one pass over each.

import { createHeightfield, type Heightfield } from "../lib/heightfield.ts";
import { clamp } from "../lib/math.ts";
import { valueNoise } from "../lib/noise.ts";
import type { Rng } from "../lib/prng.ts";
import type { Route } from "./route.ts";
import { LEVEL_RULES as R, inBand } from "./rules.ts";
import type { Bounds, Vec2 } from "./types.ts";

/** An island: a blob of land standing in the basin. `r` is its mean plan
 * radius, m; its edge is warped by noise so it is a place rather than a
 * disc. */
export type Island = {
  readonly x: number;
  readonly z: number;
  readonly r: number;
  readonly seed: number;
};

export type Basin = {
  /** Metres from the water's edge, positive in the water. */
  readonly offshore: Heightfield;
  readonly islands: readonly Island[];
  /** The OPEN SEA's straight edge: the heading the open water lies in from
   * anywhere in the level, and how far along that heading the edge is cut.
   * Everything with `x·sin + z·cos` past the offset is sea. */
  readonly seaHeading: number;
  readonly seaOffset: number;
};

/** The box a route needs: everything its corridor covers, padded for the
 * land behind it, snapped out to the grid so the bounds ARE the grid's. */
export function routeBounds(route: Route): Bounds {
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (const p of route.points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  const pad = R.route.corridor.max + R.bounds.land;
  const cell = R.grid.cell;
  const snap = (v: number, up: boolean): number =>
    (up ? Math.ceil(v / cell) : Math.floor(v / cell)) * cell;
  return {
    minX: snap(minX - pad, false),
    maxX: snap(maxX + pad, true),
    minZ: snap(minZ - pad, false),
    maxZ: snap(maxZ + pad, true),
  };
}

/** How far out from the line the stamp reaches, m: past the widest corridor
 * and the whole depth of land the profile shapes, after which the ground is
 * the plateau and one more metre of accuracy buys nothing. */
const STAMP_REACH = R.route.corridor.max + R.land.reach + R.grid.cell * 4;

/** How finely the line is resampled when it is stamped, m. A stamp reads
 * the distance to a POINT rather than to the segment it lies on, so half a
 * step is the most it can overstate — metres, in the middle of a channel,
 * where the bed is flat and nothing reads it closely. */
const STAMP_STEP = 5;

export function layBasin(rng: Rng, route: Route, bounds: Bounds): Basin {
  const cell = R.grid.cell;
  const cols = Math.round((bounds.maxX - bounds.minX) / cell) + 1;
  const rows = Math.round((bounds.maxZ - bounds.minZ) / cell) + 1;
  const offshore = createHeightfield(bounds.minX, bounds.minZ, cell, cols, rows);

  // ── The corridor ──────────────────────────────────────────────────────
  // `near` is the least distance to the line found so far, `owed` the
  // half-width the winning sample was owed.
  const near = new Float64Array(cols * rows).fill(Infinity);
  const owed = new Float64Array(cols * rows);
  const reach2 = STAMP_REACH * STAMP_REACH;
  const stamp = (x: number, z: number, width: number): void => {
    const c0 = Math.max(0, Math.floor((x - STAMP_REACH - bounds.minX) / cell));
    const c1 = Math.min(cols - 1, Math.ceil((x + STAMP_REACH - bounds.minX) / cell));
    const r0 = Math.max(0, Math.floor((z - STAMP_REACH - bounds.minZ) / cell));
    const r1 = Math.min(rows - 1, Math.ceil((z + STAMP_REACH - bounds.minZ) / cell));
    for (let r = r0; r <= r1; r++) {
      const dz = bounds.minZ + r * cell - z;
      const row = r * cols;
      for (let c = c0; c <= c1; c++) {
        const dx = bounds.minX + c * cell - x;
        const d2 = dx * dx + dz * dz;
        if (d2 >= reach2) continue;
        const i = row + c;
        if (d2 < near[i]) {
          near[i] = d2;
          owed[i] = width;
        }
      }
    }
  };
  for (let s = 0; s <= route.length; s += STAMP_STEP) {
    const at = pointOn(route, s);
    stamp(at.x, at.z, at.width);
  }

  // ── The open sea ──────────────────────────────────────────────────────
  // A straight edge just outside the route's most seaward reach: the
  // seaward normal is the route's overall heading turned a quarter, and the
  // edge stands `sea.line.edge` metres beyond the furthest the line gets
  // that way.
  //
  // JUST outside, and that is R1. The course has to stay inside
  // `course.offshore` of land, and the open sea has no far side — a line
  // cut through the middle of the route's spread would put a stretch of the
  // race four hundred metres from anything, which is not a coastal race any
  // more. Set here, the whole route is inside the band by construction: the
  // corridor bounds it where the water is the route's own, and this edge
  // bounds it where the water is the sea's.
  const a = route.points[0];
  const b = route.points[route.points.length - 1];
  const run = Math.atan2(b.x - a.x, b.z - a.z);
  const seaHeading = run + (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
  const sx = Math.sin(seaHeading);
  const sz = Math.cos(seaHeading);
  // The edge stands `sea.line.edge` metres SHORT of the route's own most
  // seaward point, so that point is exactly that far out into open water —
  // inside R1 — and everything past it is sea.
  let highU = -Infinity;
  for (const p of route.points) highU = Math.max(highU, p.x * sx + p.z * sz);
  const seaOffset = highU - inBand(rng, R.sea.line.edge);

  // ── The islands ───────────────────────────────────────────────────────
  const islands: Island[] = [];
  const wanted = rng.int(R.island.count.min, R.island.count.max);
  for (let n = 0; n < wanted; n++) {
    for (let attempt = 0; attempt < R.island.tries; attempt++) {
      // Placed against the route's own line: a station on it, pushed out to
      // the side by more than the corridor, so an island stands in the
      // water the course runs through rather than out in the empty sea.
      const at = pointOn(route, rng.range(0, route.length));
      const side = rng.chance(0.5) ? 1 : -1;
      const r = inBand(rng, R.island.r);
      // Measured to the island's WIDEST possible edge, not its mean
      // radius: the rim is warped by up to `island.warp` of it, and an
      // island placed on the mean pinches the corridor by the difference
      // wherever the warp bulges toward the line.
      const out =
        at.width + R.island.clear + r * (1 + R.island.warp) + rng.range(0, R.island.spread);
      const head = Math.atan2(at.dx, at.dz) + (side * Math.PI) / 2;
      const x = at.x + Math.sin(head) * out;
      const z = at.z + Math.cos(head) * out;
      if (!insideBox(bounds, x, z, r)) continue;
      if (islands.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r + R.island.apart)) continue;
      islands.push({ x, z, r, seed: rng.int(1, 0x7fffffff) });
      break;
    }
  }

  // ── One field out of the three ────────────────────────────────────────
  for (let r = 0; r < rows; r++) {
    const z = bounds.minZ + r * cell;
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const x = bounds.minX + c * cell;
      const corridor = owed[i] - Math.sqrt(near[i]);
      const sea = x * sx + z * sz - seaOffset;
      let water = Math.max(corridor, sea);
      for (const island of islands) water = Math.min(water, -islandAt(island, x, z));
      offshore.data[i] = water;
    }
  }
  return { offshore, islands, seaHeading, seaOffset };
}

/** Where a station of the route stands, the half-width owed there, and the
 * line's own direction — everything a placer needs off the line. */
export function pointOn(
  route: Route,
  s: number,
): { x: number; z: number; width: number; dx: number; dz: number } {
  const { points, along, widths } = route;
  const at = clamp(s, 0, route.length);
  let i = 0;
  let hi = points.length - 1;
  while (i + 1 < hi) {
    const mid = (i + hi) >> 1;
    if (along[mid] <= at) i = mid;
    else hi = mid;
  }
  const j = Math.min(i + 1, points.length - 1);
  const span = along[j] - along[i] || 1;
  const t = clamp((at - along[i]) / span, 0, 1);
  const dx = points[j].x - points[i].x;
  const dz = points[j].z - points[i].z;
  const len = Math.hypot(dx, dz) || 1;
  return {
    x: points[i].x + dx * t,
    z: points[i].z + dz * t,
    width: widths[i] + (widths[j] - widths[i]) * t,
    dx: dx / len,
    dz: dz / len,
  };
}

/** How far INSIDE an island a plan point is, m — negative outside it. The
 * edge is warped by a noise read on the angle round the island, so a blob
 * is a headland and a cove rather than a circle. */
function islandAt(island: Island, x: number, z: number): number {
  const dx = x - island.x;
  const dz = z - island.z;
  const d = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz);
  // Sampled on a circle of the island's own size, so the warp's period is a
  // share of its rim however big it is.
  const warp =
    (valueNoise(
      Math.sin(angle) * island.r,
      Math.cos(angle) * island.r,
      island.r * R.island.warpScale,
      island.seed,
    ) -
      0.5) *
    2;
  return island.r * (1 + warp * R.island.warp) - d;
}

function insideBox(bounds: Bounds, x: number, z: number, margin: number): boolean {
  return (
    x - margin >= bounds.minX &&
    x + margin <= bounds.maxX &&
    z - margin >= bounds.minZ &&
    z + margin <= bounds.maxZ
  );
}

/** The water's edge as polylines — the coastlines, traced out of the baked
 * field by marching squares. One for the mainland, one round every island
 * the field actually carries; drawn by the minimap and the level plan, and
 * walked by the analysis. */
export function traceCoast(field: Heightfield): Vec2[][] {
  const { cols, rows, cell, originX, originZ, data } = field;
  const at = (c: number, r: number): number => data[r * cols + c];
  const lines: Vec2[][] = [];
  // Marching squares, emitting one segment per crossed cell; the segments
  // are then chained into runs. A cell's case is the four corners' signs.
  const segs: { a: Vec2; b: Vec2 }[] = [];
  const lerp = (p: Vec2, q: Vec2, va: number, vb: number): Vec2 => {
    const t = va === vb ? 0.5 : va / (va - vb);
    return { x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t };
  };
  for (let r = 0; r + 1 < rows; r++) {
    for (let c = 0; c + 1 < cols; c++) {
      const v = [at(c, r), at(c + 1, r), at(c + 1, r + 1), at(c, r + 1)];
      const p = [
        { x: originX + c * cell, z: originZ + r * cell },
        { x: originX + (c + 1) * cell, z: originZ + r * cell },
        { x: originX + (c + 1) * cell, z: originZ + (r + 1) * cell },
        { x: originX + c * cell, z: originZ + (r + 1) * cell },
      ];
      const crossings: Vec2[] = [];
      for (let e = 0; e < 4; e++) {
        const f = (e + 1) % 4;
        if (v[e] >= 0 !== v[f] >= 0) crossings.push(lerp(p[e], p[f], v[e], v[f]));
      }
      if (crossings.length === 2) segs.push({ a: crossings[0], b: crossings[1] });
    }
  }
  // Chain the segments end to end. The field is smooth, so a segment's end
  // meets the next one's start to within a rounding.
  const key = (p: Vec2): string => `${Math.round(p.x * 4)},${Math.round(p.z * 4)}`;
  const byStart = new Map<string, { a: Vec2; b: Vec2 }[]>();
  for (const s of segs) {
    for (const end of [s.a, s.b]) {
      const k = key(end);
      const list = byStart.get(k);
      if (list) list.push(s);
      else byStart.set(k, [s]);
    }
  }
  const used = new Set<{ a: Vec2; b: Vec2 }>();
  for (const seed of segs) {
    if (used.has(seed)) continue;
    used.add(seed);
    const line = [seed.a, seed.b];
    for (;;) {
      const tail = line[line.length - 1];
      const next = (byStart.get(key(tail)) ?? []).find((s) => !used.has(s));
      if (!next) break;
      used.add(next);
      line.push(key(next.a) === key(tail) ? next.b : next.a);
    }
    if (line.length >= R.shore.minRun) lines.push(line);
  }
  lines.sort((a, b) => b.length - a.length);
  return lines;
}
