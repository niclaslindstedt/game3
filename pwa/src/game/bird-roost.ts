// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE EVERY FLOCK LIVES — the birds' placer, laid once per level off the
// renderer's own generator.
//
// The other half of `bird-plan.ts`, which is the MODEL: this file decides
// where a flock's home and its beat STAND, and that one says where each
// bird of it is at a moment. They split because between them they were at
// the §20.5 cap and the line between them is the obvious one — a placer
// asks the level questions (how deep is it here, what is in the lee of
// that skerry, how tall is the tallest pine, how far is this off the
// racing line) and the model asks the clock.
//
// Three-free, like the model, so `tests/birds_test.ts` reads it directly.
// Deterministic in the level's seed, so a seed flies the same birds every
// time without costing the run a single draw (§25.2).
//
// WHERE A HOME MAY BE. Four of the five kinds are the shore's — a raft in
// the lee of something, a rock or a buoy, the crown of a tall tree, a few
// metres up the beach — and all four are within a couple of hundred
// metres of the water's edge by construction. The fifth is the reason
// this file has a `sea` block at all: a bird of the OPEN water has no
// shore roost to be near, rafts far out in water nothing shelters, and
// has to be allowed to live the whole way out to the seaward edge of the
// level. Without it the sky past the buoys was as empty as the water
// under it was.

import {
  TAU,
  createRng,
  cumulative,
  fieldGradient,
  sampleField,
  type Level,
  type Rng,
  type Vec2,
} from "@engine";

import { BIRDS, type Band, type BirdId, type BirdSpec } from "./bird-defs.ts";
import { FLORA, PERCH_TREES } from "./flora-defs.ts";
import { planFlora } from "./flora-plan.ts";
import { FLORA_SCALE } from "./settings-video.ts";
import type { BirdPlan, Flock, Roost } from "./bird-plan.ts";

/** How often a crossing is pitched in a passage season, s. At a goose's
 * pace a crossing is two minutes in the sky, so two or three are up at
 * once through a spring run. */
const CROSSING_INTERVAL = 48;

/** How close to the COURSE a flock's home has to be, m, and how close its
 * LOOP's centre: a run is ridden along the racing line, and a raft of
 * eider three hundred metres up a back bay is a raft nobody meets. The
 * beat is held nearer than the roost, because the beat is where the
 * flock is in the air — a gull wheeling a hundred metres off the line is
 * a bird, and one three hundred metres off is grit. */
const NEAR_COURSE = 240;
const NEAR_LOOP = 150;

/** How far off the home a flock's loop is centred, m, and the water a raft
 * needs under it, m. */
const LOOP_OUT: Band = { min: 15, max: 70 };
const RAFT_DEPTH = 1.2;
const RAFT_OFFSHORE: Band = { min: 8, max: 110 };
/** How far out the shelter ring is thrown for a raft, m, and how much of
 * it a sea duck wants to be land: eider sit in the lee of something. */
const LEE_RING = 45;
const LEE_WANT = 0.15;
/** How tall a tree has to be for anything to perch on it, m, and how far
 * up it the perch is — a crown, not a tip. */
const PERCH_TREE = 9;
const PERCH_CROWN = 0.94;
/** How many attempts a flock gets at a home before the coast is judged to
 * have no place for it. */
const TRIES = 28;

function inBand(rng: Rng, band: Band): number {
  return rng.range(band.min, band.max);
}

/** How many flocks a stretch of coast carries: the whole part of the
 * expectation, plus the fraction as a chance of one more. */
function flockCount(rng: Rng, perKm: number, km: number): number {
  const expected = perKm * km;
  const whole = Math.floor(expected);
  return whole + (rng.chance(expected - whole) ? 1 : 0);
}

/** Ramanujan's ellipse perimeter, exact enough at these eccentricities. */
function perimeter(a: number, b: number): number {
  const h = ((a - b) / (a + b)) ** 2;
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

/** What share of a ring stands out of the water — how much lee a piece of
 * sea has. */
function leeAt(level: Level, x: number, z: number): number {
  let land = 0;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU;
    if (sampleField(level.ground, x + Math.sin(a) * LEE_RING, z + Math.cos(a) * LEE_RING) > 0) {
      land++;
    }
  }
  return land / 6;
}

/** How far a plan point is from the racing line, m. Brute force over the
 * path: asked a few hundred times at load and never again. */
function pathDistance(path: readonly Vec2[], x: number, z: number): number {
  let best = Infinity;
  for (const p of path) {
    const d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

/** Every station of every coastline, for a shore roost to be thrown from. */
function shorePoints(level: Level): readonly Vec2[] {
  const out: Vec2[] = [];
  for (const line of level.shore) for (const p of line) out.push(p);
  return out;
}

/**
 * THE TREES A BIRD CAN SIT IN: the crowns of the shore's tall trees, from
 * the cover as `flora-plan.ts` plants it at its SPARSEST — the plants every
 * DETAIL stop draws, so a perch is never the top of a tree the rider's
 * settings left out. Planted here rather than handed in from the renderer,
 * because a scenario and a test have to find the same eagle on the same
 * branch without a renderer in sight.
 */
export function treePerches(level: Level): Roost[] {
  const spots = planFlora(level, FLORA_SCALE.sparse);
  const perches: Roost[] = [];
  FLORA.forEach((spec, s) => {
    if (!PERCH_TREES.includes(spec.id)) return;
    for (const p of spots[s]) {
      if (p.h < PERCH_TREE) continue;
      perches.push({ kind: "tree", x: p.x, z: p.z, y: p.y + p.h * PERCH_CROWN });
    }
  });
  return perches;
}

/**
 * Lay every flock the season allows over the level, and decide what
 * crosses it. Deterministic in the level's seed on the renderer's own
 * generator (§25.2), so nothing here costs the run a draw.
 */
export function planBirds(level: Level, perches: readonly Roost[] = treePerches(level)): BirdPlan {
  const rng = createRng(level.seed ^ 0x6b1d);
  const km = level.course.length / 1000;
  const path = level.course.path;
  const shore = shorePoints(level);
  const rocks = level.solids.filter(
    (s) =>
      (s.kind === "skerry" || s.kind === "stack" || s.kind === "mark" || s.kind === "buoy") &&
      s.top > 0.3,
  );
  const b = level.bounds;
  const inside = (x: number, z: number, margin = 0): boolean =>
    x > b.minX + margin && x < b.maxX - margin && z > b.minZ + margin && z < b.maxZ - margin;
  const flocks: Flock[] = [];

  /** One try at a home for a flock of this species: where it sits, how
   * wide, and how many can (a buoy takes two gulls, not a colony). */
  const homeFor = (
    spec: BirdSpec,
    count: number,
  ): { home: Roost; roost: number; count: number } | null => {
    switch (spec.home) {
      case "water": {
        const x = rng.range(b.minX, b.maxX);
        const z = rng.range(b.minZ, b.maxZ);
        const off = sampleField(level.offshore, x, z);
        const band = spec.sea ? spec.sea.offshore : RAFT_OFFSHORE;
        if (off < band.min || off > band.max) return null;
        if (-sampleField(level.ground, x, z) < RAFT_DEPTH) return null;
        // Only a COASTAL raft is asked for a lee: out where a pelagic bird
        // sits there is nothing to be in the lee of, and asking would hold
        // every one of them back inshore against the point of the row.
        if (!spec.sea && leeAt(level, x, z) < LEE_WANT) return null;
        return { home: { kind: "water", x, z, y: 0 }, roost: spec.roost, count };
      }
      case "skerry": {
        if (rocks.length === 0) return null;
        const s = rng.pick(rocks);
        const buoy = s.kind === "buoy";
        return {
          home: { kind: "skerry", x: s.x, z: s.z, y: s.top },
          roost: buoy ? 0.3 : Math.min(spec.roost, s.r * 0.55),
          count: buoy ? Math.min(count, 2) : count,
        };
      }
      case "tree": {
        if (perches.length === 0) return null;
        return { home: rng.pick(perches), roost: spec.roost, count };
      }
      case "shore": {
        if (shore.length === 0) return null;
        const at = rng.pick(shore);
        // A few metres up from the water's edge, down the offshore
        // field's gradient — the first step that lands on dry ground.
        const g = fieldGradient(level.offshore, at.x, at.z);
        const n = Math.hypot(g.gx, g.gz);
        if (n < 1e-6) return null;
        for (let step = 1; step <= 4; step++) {
          const x = at.x - (g.gx / n) * step * 2.5;
          const z = at.z - (g.gz / n) * step * 2.5;
          const y = sampleField(level.ground, x, z);
          if (y > 0.15 && y < 3 && level.materialAt(x, z) !== "water") {
            return { home: { kind: "shore", x, z, y }, roost: spec.roost, count };
          }
        }
        return null;
      }
      default:
        return null;
    }
  };

  for (const spec of BIRDS) {
    if (!spec.biomes.includes(level.biome)) continue;
    if (spec.home === undefined || spec.perKm <= 0) continue;
    if (!spec.seasons.includes(level.season)) continue;
    const want = flockCount(rng, spec.perKm, km);
    // How far off the racing line this row may live and beat — the shore's
    // own numbers, or the bird's own when it is a bird of the open water.
    const near = spec.sea ? spec.sea.reach : NEAR_COURSE;
    const nearLoop = spec.sea ? spec.sea.reach : NEAR_LOOP;
    for (let n = 0; n < want; n++) {
      for (let attempt = 0; attempt < TRIES; attempt++) {
        const size = rng.int(spec.flock.min, spec.flock.max);
        const found = homeFor(spec, size);
        if (!found) continue;
        const { home } = found;
        if (!inside(home.x, home.z)) continue;
        if (pathDistance(path, home.x, home.z) > near) continue;
        // The loop it flies, off to one side of the home and over the
        // water — a gull's beat is the shallows, not the wood — and kept
        // inside the level with its whole radius.
        const bearing = rng.range(0, TAU);
        const out = inBand(rng, LOOP_OUT);
        const cx = home.x + Math.sin(bearing) * out;
        const cz = home.z + Math.cos(bearing) * out;
        const radius = inBand(rng, spec.beat);
        if (!inside(cx, cz, radius)) continue;
        if (pathDistance(path, cx, cz) > nearLoop) continue;
        if (spec.home !== "tree" && sampleField(level.offshore, cx, cz) < 0) continue;
        const ovality = rng.range(0.45, 0.9);
        const heading = rng.range(0, TAU);
        const sense: 1 | -1 = rng.chance(0.5) ? 1 : -1;
        const altitude = inBand(rng, spec.altitude);
        flocks.push({
          id: `B${flocks.length + 1}`,
          species: spec.id,
          count: found.count,
          home,
          roost: found.roost,
          facing: level.wind.from,
          loop: {
            x: cx,
            z: cz,
            radius,
            ovality,
            heading,
            sense,
            altitude,
            period: perimeter(radius, radius * ovality) / spec.speed,
          },
          cycle: inBand(rng, spec.cycle),
          airShare: spec.airShare,
          phase: rng.next(),
          scatter: rng.int(1, 0x7fffffff),
        });
        break;
      }
    }
  }

  // What CROSSES this season, each bird repeated by its share.
  const crossers: BirdId[] = [];
  for (const spec of BIRDS) {
    if (!spec.biomes.includes(level.biome)) continue;
    if (!spec.passage || !spec.passes.includes(level.season)) continue;
    for (let i = 0; i < spec.passage.share; i++) crossers.push(spec.id);
  }
  return {
    seed: level.seed,
    flocks,
    interval: crossers.length > 0 ? CROSSING_INTERVAL : Infinity,
    crossers,
    path,
    cum: cumulative(path),
  };
}
