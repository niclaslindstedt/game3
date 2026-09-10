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
import { riverDistance, type River } from "./river.ts";
import type { CoastRoute, Route } from "./route.ts";
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
 * land behind it, snapped out to the grid so the bounds ARE the grid's.
 *
 * The ROUTE'S box, not the level's — `levelBounds` adds the river to it.
 * They are two boxes on purpose: this one is where the race is, and it is
 * what the rocks and the sea life are scattered over (R17, R20), so a
 * river running a kilometre inland does not thin the coast the rider
 * actually rides past by spreading the same count over twice the plan. */
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
  return padded(minX, minZ, maxX, maxZ, R.route.corridor.max + R.bounds.land);
}

/** R26 — the level's own box: the route's, opened out to hold the river.
 * The river's own pad is its own widest water plus the land behind it,
 * rather than the corridor's — a creek three metres across does not need a
 * bay's worth of country either side of it. */
export function levelBounds(route: Route, river: River): Bounds {
  const box = routeBounds(route);
  let minX = box.minX;
  let minZ = box.minZ;
  let maxX = box.maxX;
  let maxZ = box.maxZ;
  for (let i = 0; i < river.points.length; i++) {
    const p = river.points[i];
    const pad = river.widths[i] + R.bounds.land;
    minX = Math.min(minX, p.x - pad);
    maxX = Math.max(maxX, p.x + pad);
    minZ = Math.min(minZ, p.z - pad);
    maxZ = Math.max(maxZ, p.z + pad);
  }
  return padded(minX, minZ, maxX, maxZ, 0);
}

/**
 * R29 — WHERE THE COAST STANDS on a circuit: the offset of the open sea's
 * straight edge along the sea's own heading.
 *
 * Cut back from the loop's most INSHORE station by the offshore distance
 * this level is drawn at AND by the whole amplitude the edge wanders in and
 * out over, so R29's floor holds at the one station where the coast could
 * bulge furthest toward the line. Everywhere else on the loop the water is
 * deeper and the shore further, which is what a circuit is.
 *
 * Drawn here rather than inside the basin because the level's own box has
 * to know where the land is before there is a field to read it off — the
 * same reason the coast's `seaEdge` is worked out in the generator.
 */
export function oceanEdge(rng: Rng, route: Route): number {
  const sx = Math.sin(route.seaHeading);
  const sz = Math.cos(route.seaHeading);
  let inshore = Infinity;
  for (const p of route.points) inshore = Math.min(inshore, p.x * sx + p.z * sz);
  return inshore - inBand(rng, R.circuit.offshore) - R.circuit.coast.wander.amplitude;
}

/**
 * R14, R29 — a circuit's box: the loop, the open sea outside it, and the
 * strip of coast the level carries on one side of it.
 *
 * Measured in the sea's own frame rather than in the world's — how far out
 * to sea, how far in past the coast, how far along it — and then squared
 * off to the grid the level's bounds ARE. The union with the loop's own box
 * padded all round is what keeps R14's padding rule true whichever way the
 * sea happens to lie: the frame's rectangle covers the coast, and the pad
 * covers the corners the rotation would otherwise cut.
 */
export function circuitBounds(route: Route, seaOffset: number): Bounds {
  const sx = Math.sin(route.seaHeading);
  const sz = Math.cos(route.seaHeading);
  let outer = -Infinity;
  let alongMin = Infinity;
  let alongMax = -Infinity;
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (const p of route.points) {
    outer = Math.max(outer, p.x * sx + p.z * sz);
    const along = p.x * sz - p.z * sx;
    alongMin = Math.min(alongMin, along);
    alongMax = Math.max(alongMax, along);
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  // The inland edge stands past everything the field still measures (R2),
  // with the land's own pad behind it, so no cell of country is cut off
  // mid-profile.
  const inner = seaOffset - R.land.measured - R.bounds.land;
  const off = outer + R.bounds.sea;
  const side = R.circuit.coast.run;
  for (const u of [inner, off]) {
    for (const v of [alongMin - side, alongMax + side]) {
      const x = u * sx + v * sz;
      const z = u * sz - v * sx;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
  }
  return padded(minX, minZ, maxX, maxZ, R.bounds.sea);
}

function padded(minX: number, minZ: number, maxX: number, maxZ: number, pad: number): Bounds {
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

/** How far out from a line of half-width `width` the stamp reaches, m: past
 * the water it is owed and the whole depth of land the profile shapes,
 * after which the ground is the plateau and one more metre of accuracy buys
 * nothing. Read per line rather than once for the level, because the river
 * thins to a creek and stamping a creek's banks to a bay's reach is most of
 * a level's build time spent on cells that will read the plateau anyway. */
function stampReach(width: number): number {
  return width + R.land.measured;
}

/** What a cell further from every line than the stamp reaches reads, m: the
 * field's own inland limit (R2's `land.measured`), which is exactly what a
 * cell ON the stamp's rim reads, so the field is continuous across it and
 * carries no infinity for a bilinear sample to turn into a NaN. */
const FAR_INLAND = -R.land.measured;

/** How finely the line is resampled when it is stamped, m. A stamp reads
 * the distance to a POINT rather than to the segment it lies on, so half a
 * step is the most it can overstate — metres, in the middle of a channel,
 * where the bed is flat and nothing reads it closely.
 *
 * TWICE over every line, and this is the fine pass. The overstatement a
 * sampled line makes falls away with distance — at 5 m spacing it is 1.7 m
 * a metre off the line and 0.02 m forty metres off — so only the water and
 * the shore just behind it need this step. The country beyond is stamped
 * at `COARSE_STEP` for the same field to a fortieth of a metre, and the
 * stamp is the biggest single cost in building a level.
 *
 * The coarse step is a MULTIPLE of the fine one, which is what makes the
 * two passes agree rather than merely nearly agree: every coarse sample
 * stands exactly where a fine one does, so where both reach a cell the
 * fine pass's distance is the smaller and wins. */
const STAMP_STEP = 5;
const COARSE_STEP = 20;
/** How far past the water it is owed the fine pass reaches, m. */
const FINE_REACH = 40;

export function layBasin(rng: Rng, route: CoastRoute, river: River, bounds: Bounds): Basin {
  const cell = R.grid.cell;
  const cols = Math.round((bounds.maxX - bounds.minX) / cell) + 1;
  const rows = Math.round((bounds.maxZ - bounds.minZ) / cell) + 1;
  const offshore = createHeightfield(bounds.minX, bounds.minZ, cell, cols, rows);

  // ── The corridor ──────────────────────────────────────────────────────
  // `near` is the least distance to the line found so far, `owed` the
  // half-width the winning sample was owed.
  const near = new Float64Array(cols * rows).fill(Infinity);
  const owed = new Float64Array(cols * rows);
  const stamp = (x: number, z: number, width: number, reach: number): void => {
    const reach2 = reach * reach;
    const r0 = Math.max(0, Math.ceil((z - reach - bounds.minZ) / cell));
    const r1 = Math.min(rows - 1, Math.floor((z + reach - bounds.minZ) / cell));
    for (let r = r0; r <= r1; r++) {
      const dz = bounds.minZ + r * cell - z;
      // The row's own half-width off the circle rather than the box's.
      // The stamp is the level's single biggest cost and a fifth of a
      // box's cells are outside the disc inscribed in it — that fifth was
      // being visited to be rejected, on every sample of every line.
      const half = Math.sqrt(reach2 - dz * dz);
      const c0 = Math.max(0, Math.ceil((x - half - bounds.minX) / cell));
      const c1 = Math.min(cols - 1, Math.floor((x + half - bounds.minX) / cell));
      const row = r * cols;
      for (let c = c0; c <= c1; c++) {
        const dx = bounds.minX + c * cell - x;
        const d2 = dx * dx + dz * dz;
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
    stamp(at.x, at.z, at.width, at.width + FINE_REACH);
  }
  for (let s = 0; s <= route.length; s += COARSE_STEP) {
    const at = pointOn(route, s);
    stamp(at.x, at.z, at.width, stampReach(at.width));
  }
  // R26 — and the river, stamped into the SAME field by the same rule. The
  // basin does not know a sample of the racing line from a sample of a
  // watercourse; it knows how far a cell is from the nearest of them and
  // what that one was owed, which is all a signed offshore field is.
  const stampRiver = (step: number, reachOf: (width: number) => number): void => {
    // Walked by ARC LENGTH rather than per segment, so the samples are
    // evenly spaced across the joins: a river's steps are 12 m and the
    // stamp's are 5 and 20, and none of them divides the others.
    let next = 0;
    let at = 0;
    for (let i = 0; i + 1 < river.points.length; i++) {
      const a = river.points[i];
      const b = river.points[i + 1];
      const span = Math.hypot(b.x - a.x, b.z - a.z);
      while (next < at + span) {
        const t = (next - at) / span;
        const width = river.widths[i] + (river.widths[i + 1] - river.widths[i]) * t;
        stamp(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, width, reachOf(width));
        next += step;
      }
      at += span;
    }
    const last = river.points.length - 1;
    const width = river.widths[last];
    stamp(river.points[last].x, river.points[last].z, width, reachOf(width));
  };
  stampRiver(STAMP_STEP, (w) => w + FINE_REACH);
  stampRiver(COARSE_STEP, stampReach);

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
  const seaHeading = route.seaHeading;
  const sx = Math.sin(seaHeading);
  const sz = Math.cos(seaHeading);
  // The edge stands `sea.line.edge` metres SHORT of the route's own most
  // seaward point, so that point is exactly that far out into open water —
  // inside R1 — and everything past it is sea.
  //
  // Measured over the route MINUS its ocean leg (R25). The leg is drawn to
  // stand out past R1's ceiling on purpose; cutting the edge short of ITS
  // furthest point would put the whole leg back inside the band and leave
  // the race a coastal one with a bulge in it.
  let highU = -Infinity;
  for (let i = 0; i < route.points.length; i++) {
    if (route.along[i] >= route.leg.from && route.along[i] <= route.leg.to) continue;
    const p = route.points[i];
    highU = Math.max(highU, p.x * sx + p.z * sz);
  }
  const seaOffset = highU - inBand(rng, R.sea.line.edge);

  // ── The islands ───────────────────────────────────────────────────────
  const islands: Island[] = [];
  const wanted = rng.int(R.island.count.min, R.island.count.max);
  for (let n = 0; n < wanted; n++) {
    for (let attempt = 0; attempt < R.island.tries; attempt++) {
      // Placed against the route's own line: a station on it, pushed out to
      // the side by more than the corridor, so an island stands in the
      // water the course runs through rather than out in the empty sea.
      //
      // Never against the OCEAN LEG (R25). Out there the level's whole
      // point is open water with one rock in it, and an island beside the
      // run to the mark is a coastline where the leg's reach is measured
      // from — the leg comes out inside R1's band with an island for a
      // shore, which is not what it was drawn for.
      const on = rng.range(0, route.length - (route.leg.to - route.leg.from));
      const at = pointOn(route, on < route.leg.from ? on : on + (route.leg.to - route.leg.from));
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
      // R26 — and clear of the river: an island cut out of a channel three
      // metres wider than itself is a dam, and the water above it is a
      // reach nothing can get to.
      if (riverDistance(river, x, z) < r * (1 + R.island.warp) + R.island.clear) continue;
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
      const corridor = near[i] === Infinity ? FAR_INLAND : owed[i] - Math.sqrt(near[i]);
      const sea = x * sx + z * sz - seaOffset;
      let water = Math.max(corridor, sea);
      for (const island of islands) water = Math.min(water, -islandAt(island, x, z));
      offshore.data[i] = water;
    }
  }
  return { offshore, islands, seaHeading, seaOffset };
}

/**
 * R29 — THE OCEAN a circuit is ridden in: the open sea, and one coast a
 * long way off on one side of it.
 *
 * There is no corridor here and there are no islands. A circuit's line
 * stands out past every coastal band before the water is carved (`oceanEdge`
 * cut the shore back for it), so a corridor stamped along the loop would
 * lose to the sea's own distance in every cell it touched and cost the
 * biggest single price in building a level to say nothing; and an island
 * cut into the water beside the line would be a shore, which is exactly
 * what R29 says the line is nowhere near. The rocks a lap goes round are
 * SOLIDS — the marks (R31) and the stacks strewn out there (R17) — and a
 * solid is not a hole in the water.
 *
 * So the field is one expression per cell: how far past the sea's edge the
 * cell stands, clamped inland at what the level still measures. The edge
 * WANDERS — a value noise on the along-shore coordinate — because a coast
 * that is a straight line at two hundred metres reads as a wall, and its
 * whole amplitude was already cut back out of the offset, so no bay it
 * makes can reach the line.
 */
export function layOceanBasin(rng: Rng, route: Route, bounds: Bounds, seaOffset: number): Basin {
  const cell = R.grid.cell;
  const cols = Math.round((bounds.maxX - bounds.minX) / cell) + 1;
  const rows = Math.round((bounds.maxZ - bounds.minZ) / cell) + 1;
  const offshore = createHeightfield(bounds.minX, bounds.minZ, cell, cols, rows);
  const seaHeading = route.seaHeading;
  const sx = Math.sin(seaHeading);
  const sz = Math.cos(seaHeading);
  const { amplitude, scale } = R.circuit.coast.wander;
  const wanderSeed = rng.int(1, 0x7fffffff);
  for (let r = 0; r < rows; r++) {
    const z = bounds.minZ + r * cell;
    for (let c = 0; c < cols; c++) {
      const x = bounds.minX + c * cell;
      const along = x * sz - z * sx;
      const wander = (valueNoise(along, 0, scale, wanderSeed) - 0.5) * 2 * amplitude;
      offshore.data[r * cols + c] = Math.max(FAR_INLAND, x * sx + z * sz - seaOffset - wander);
    }
  }
  return { offshore, islands: [], seaHeading, seaOffset };
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
