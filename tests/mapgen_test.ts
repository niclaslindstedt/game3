// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Generator invariants: the R-rules from engine/mapgen/rules.ts, asserted
// across a spread of seeds — determinism first, then every rule in the
// book held against the finished level the way the analysis holds it,
// and the generation-time bound the game's loading screen depends on.
//
// The corpus is `tests/support/levels.ts`'s: one build per seed, shared
// read-only across every `it` here. The population statistics — how the
// gate counts, lengths and winds are DISTRIBUTED across many seeds — are a
// file of their own (`mapgen_population_test.ts`), because they need more
// seeds than a rule suite does and are what a generator change is judged
// by.
import { describe, expect, it } from "vitest";

import {
  ANALYSIS,
  CRAFT,
  LEVEL_RULES as R,
  airCorridor,
  arcHeight,
  biomeOf,
  cumulative,
  daylightWindow,
  gateBuoys,
  generateLevel,
  polylineDistance,
  rampSurface,
  ringPlacement,
  sampleField,
  segmentDistance,
  solidBerth,
  solidRule,
  sunAt,
  walkPolyline,
  withinBand,
  type Level,
  type Surface,
} from "@engine";

import { LEVEL_SEEDS, analysisFor, levelFor } from "./support/levels.ts";


/** The level minus its classifier closure, for deep equality. */
function structural(level: Level): Omit<Level, "materialAt"> {
  const copy: { materialAt?: Level["materialAt"] } = { ...level };
  delete copy.materialAt;
  return copy as Omit<Level, "materialAt">;
}

/** Distance along the path of the nearest point to (x, z), m. */
function alongPath(level: Level, x: number, z: number): number {
  const path = level.course.path;
  const cum = cumulative(path);
  let best = Infinity;
  let at = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i];
    const b = path[i + 1];
    const d = segmentDistance(x, z, a.x, a.z, b.x, b.z);
    if (d < best) {
      best = d;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / len2));
      at = cum[i] + Math.sqrt(len2) * t;
    }
  }
  return at;
}

describe("level generator", () => {
  it("is deterministic per seed", () => {
    for (const seed of [1, 99, 4711]) {
      const a = generateLevel(seed);
      const b = generateLevel(seed);
      expect(structural(a)).toEqual(structural(b));
      // The classifier is a closure over the same grids and seeds; it has
      // to answer the same everywhere too.
      const { bounds } = a;
      for (let i = 0; i <= 20; i++) {
        const x = bounds.minX + ((bounds.maxX - bounds.minX) * i) / 20;
        const z = bounds.minZ + ((bounds.maxZ - bounds.minZ) * ((i * 7) % 21)) / 20;
        expect(a.materialAt(x, z)).toBe(b.materialAt(x, z));
      }
    }
  });

  it("produces different levels for different seeds", () => {
    expect(structural(levelFor(1))).not.toEqual(structural(levelFor(38)));
    expect(
      levelFor(1).course.gates.length === levelFor(38).course.gates.length &&
        levelFor(1).course.length === levelFor(38).course.length,
    ).toBe(false);
  });

  it("records the seed it was asked for, and the biome", () => {
    for (const seed of LEVEL_SEEDS) {
      expect(levelFor(seed).seed).toBe(seed);
      expect(levelFor(seed).biome).toBe("taiga");
    }
  });

  it("refuses a biome that is not built", () => {
    expect(() => generateLevel(1, { biome: "atoll" })).toThrow(/not built/);
  });

  it("throws, naming the reason, when it is given no attempts", () => {
    expect(() => generateLevel(1, { attempts: 0 })).toThrow(/level generation failed/);
  });

  it("R1 — every gate and every point of the path is within reach of the shore", () => {
    for (const seed of LEVEL_SEEDS) {
      const level = levelFor(seed);
      for (const g of level.course.gates) {
        expect(withinBand(sampleField(level.offshore, g.x, g.z), R.course.offshore)).toBe(true);
      }
      walkPolyline(level.course.path, 2, (x, z) => {
        expect(withinBand(sampleField(level.offshore, x, z), R.course.offshore)).toBe(true);
      });
    }
  });

  it("R2 — land stays under the cap, and its profile stops climbing past the reach", () => {
    for (const seed of LEVEL_SEEDS) {
      const { ground, offshore } = levelFor(seed);
      // Accumulated, not asserted per cell: a grid is a hundred thousand
      // cells and an `expect` is microseconds, which is minutes a file.
      let highest = -Infinity;
      const bins = Math.ceil((R.land.reach + ANALYSIS.land.margin * 3) / ANALYSIS.land.bin);
      const sum = new Float64Array(bins);
      const count = new Int32Array(bins);
      for (let i = 0; i < ground.data.length; i++) {
        highest = Math.max(highest, ground.data[i]);
        const off = offshore.data[i];
        if (off >= 0) continue;
        const bin = Math.min(bins - 1, Math.floor(-off / ANALYSIS.land.bin));
        sum[bin] += ground.data[i];
        count[bin]++;
      }
      expect(highest).toBeLessThanOrEqual(R.land.maxHeight);
      // The hills vary from place to place (R21), so what R2 claims is
      // about the PROFILE: past the reach, the mean height against how far
      // inland it is has stopped rising.
      const settled = Math.floor((R.land.reach + ANALYSIS.land.margin) / ANALYSIS.land.bin);
      let climb = 0;
      let seen = 0;
      for (let b = settled; b + 1 < bins; b++) {
        if (count[b] === 0 || count[b + 1] === 0) continue;
        seen++;
        climb = Math.max(
          climb,
          (sum[b + 1] / count[b + 1] - sum[b] / count[b]) / ANALYSIS.land.bin,
        );
      }
      expect(seen).toBeGreaterThan(0);
      expect(climb).toBeLessThan(ANALYSIS.land.rise);
    }
  });

  it("R3 — the bed reaches full depth and no deeper, and sea cells are under water", () => {
    for (const seed of LEVEL_SEEDS) {
      const { ground, offshore } = levelFor(seed);
      let far = 0;
      let deepest = 0;
      let shallowestFar = Infinity;
      let dry = 0;
      for (let i = 0; i < ground.data.length; i++) {
        deepest = Math.max(deepest, -ground.data[i]);
        if (offshore.data[i] >= R.sea.reach + 20) {
          far++;
          shallowestFar = Math.min(shallowestFar, -ground.data[i]);
        }
        if (offshore.data[i] >= 8 && ground.data[i] >= 0) dry++;
      }
      expect(deepest).toBeLessThanOrEqual(R.sea.openDepth + 1);
      expect(far).toBeGreaterThan(0);
      // Past the reach the shelf is complete; the bed goes on falling to
      // the open sea from there, so this is a floor and not a band.
      expect(shallowestFar).toBeGreaterThanOrEqual(R.sea.depth - 1);
      expect(dry).toBe(0);
    }
  });

  it("R3 — a bay's shelf is shallower than the open coast at the same distance", () => {
    // Read off the level: the shallowest and the deepest water at 40 m out
    // differ by more than the bed's grain can explain.
    for (const seed of LEVEL_SEEDS) {
      const { ground, offshore } = levelFor(seed);
      let shallow = Infinity;
      let deep = -Infinity;
      for (let i = 0; i < ground.data.length; i++) {
        if (Math.abs(offshore.data[i] - 40) < 2) {
          shallow = Math.min(shallow, -ground.data[i]);
          deep = Math.max(deep, -ground.data[i]);
        }
      }
      expect(deep - shallow).toBeGreaterThan(2 * R.sea.detail.amplitude);
    }
  });

  it("R4 — gates come every 80–150 m along the path, with buoys the rule's width apart", () => {
    for (const seed of LEVEL_SEEDS) {
      const level = levelFor(seed);
      const gates = level.course.gates;
      let last = alongPath(level, gates[0].x, gates[0].z);
      for (let i = 1; i < gates.length; i++) {
        const d = alongPath(level, gates[i].x, gates[i].z);
        expect(withinBand(d - last, R.gate.spacing, 0.5)).toBe(true);
        expect(gates[i].index).toBe(i);
        last = d;
      }
      for (const g of gates) {
        if (g.kind !== "water") continue;
        expect(g.width).toBe(R.gate.width);
        expect(g.y).toBe(0);
        const [a, b] = gateBuoys(g);
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeCloseTo(R.gate.width, 6);
      }
    }
  });

  it("R5 — there is deep water under the whole path", () => {
    for (const seed of LEVEL_SEEDS) {
      const level = levelFor(seed);
      walkPolyline(level.course.path, 2, (x, z) => {
        expect(-sampleField(level.ground, x, z)).toBeGreaterThanOrEqual(R.course.minDepth);
      });
    }
  });

  it("R6 — every solid keeps its margin from the path and the buoys", () => {
    for (const seed of LEVEL_SEEDS) {
      const level = levelFor(seed);
      const buoys = level.course.gates.flatMap(gateBuoys);
      for (const s of level.solids) {
        // The berth grows with the rock (R6): a sea stack is given room to
        // be gone round, a boulder room to be missed.
        const berth = solidBerth(s.r);
        expect(polylineDistance(level.course.path, s.x, s.z) - s.r).toBeGreaterThanOrEqual(berth);
        for (const b of buoys) {
          expect(Math.hypot(b.x - s.x, b.z - s.z) - s.r).toBeGreaterThanOrEqual(berth);
        }
      }
    }
  });

  it("R7 — two or three gates are rings in the air, never the first or the finish", () => {
    for (const seed of LEVEL_SEEDS) {
      const gates = levelFor(seed).course.gates;
      const air = gates.filter((g) => g.kind === "air");
      expect(withinBand(air.length, R.air.count)).toBe(true);
      expect(gates[0].kind).toBe("water");
      expect(gates[gates.length - 1].kind).toBe("water");
      for (const g of air) {
        expect(withinBand(g.y, R.air.height)).toBe(true);
        expect(g.width).toBe(R.air.width);
        expect(g.ramp).toBeDefined();
      }
    }
  });

  it("R8 — every ring has an aligned ramp the rule's distance before it", () => {
    for (const seed of LEVEL_SEEDS) {
      for (const g of levelFor(seed).course.gates) {
        if (g.kind !== "air") continue;
        const ramp = g.ramp!;
        const fx = Math.sin(ramp.heading);
        const fz = Math.cos(ramp.heading);
        const lead = (g.x - ramp.x) * fx + (g.z - ramp.z) * fz;
        const across = (g.x - ramp.x) * fz - (g.z - ramp.z) * fx;
        expect(withinBand(lead, R.ramp.lead, 0.5)).toBe(true);
        expect(Math.abs(across)).toBeLessThan(0.5);
        expect(ramp.heading).toBeCloseTo(g.heading, 6);
        expect(withinBand(ramp.length, R.ramp.length)).toBe(true);
        expect(ramp.width).toBe(R.ramp.width);
        expect(withinBand(ramp.angle, R.ramp.angle)).toBe(true);
        // The hinge convention: level at the rear edge, rising to the
        // front, nothing beside it.
        expect(rampSurface(ramp, ramp.x, ramp.z)).toBeCloseTo(0, 9);
        // Just inside the lip: the edge itself is a float coin-toss. The
        // deck's `length` is its plan footprint, so the lip is length·tan.
        const footprint = ramp.length * 0.999;
        const front = rampSurface(ramp, ramp.x + fx * footprint, ramp.z + fz * footprint);
        expect(front).toBeCloseTo(footprint * Math.tan(ramp.angle), 6);
        expect(rampSurface(ramp, ramp.x - fx, ramp.z - fz)).toBeNull();
        expect(
          rampSurface(
            ramp,
            ramp.x + fz * (ramp.width / 2 + 0.1),
            ramp.z - fx * (ramp.width / 2 + 0.1),
          ),
        ).toBeNull();
      }
    }
  });

  it("R18 — every ring sits on the design arc, and the slowest craft can bring the speed", () => {
    const g = 9.81;
    const slowest = Math.min(...CRAFT.map((c) => c.topSpeed)) / 3.6;
    for (const seed of LEVEL_SEEDS) {
      for (const gate of levelFor(seed).course.gates) {
        if (gate.kind !== "air") continue;
        const ramp = gate.ramp!;
        const ring = ringPlacement(ramp.length, ramp.angle);
        const lead = Math.hypot(gate.x - ramp.x, gate.z - ramp.z);
        expect(lead).toBeCloseTo(ring.lead, 1);
        expect(gate.y).toBeCloseTo(ring.y, 6);
        expect(withinBand(lead, R.ramp.lead)).toBe(true);
        expect(withinBand(gate.y, R.air.height)).toBe(true);
        // The slow design arc from the lowest-riding hull passes within
        // the ring, the fast one from the highest-riding hull too, and
        // the ring is past the apex on the slow arc.
        const lip = ramp.length * Math.tan(ramp.angle);
        const d = lead - ramp.length;
        const cogs = CRAFT.map((c) => c.cog.y);
        const ySlow = arcHeight(lip + Math.min(...cogs), R.air.lipSpeed.min, ramp.angle, d);
        const yFast = arcHeight(lip + Math.max(...cogs), R.air.lipSpeed.max, ramp.angle, d);
        expect(Math.abs(ySlow - gate.y)).toBeLessThan(R.air.width / 2 - R.air.thread);
        expect(Math.abs(yFast - gate.y)).toBeLessThan(R.air.width / 2 - R.air.thread);
        const apex = (R.air.lipSpeed.min ** 2 * Math.sin(ramp.angle) * Math.cos(ramp.angle)) / g;
        expect(d).toBeGreaterThan(apex);
        // ...and the hinge speed the slow arc implies is one the slowest
        // craft has in hand.
        const hinge = Math.sqrt(R.air.lipSpeed.max ** 2 + 2 * g * lip);
        expect(hinge).toBeLessThan(slowest * R.air.reach);
      }
    }
  });

  it("R9 — the run-up is straight, deep and clear across the ramp's width", () => {
    for (const seed of LEVEL_SEEDS) {
      const level = levelFor(seed);
      const path = level.course.path;
      const cum = cumulative(path);
      for (const g of level.course.gates) {
        if (g.kind !== "air") continue;
        const c = airCorridor(g);
        const from = alongPath(level, c.x0, c.z0);
        const to = alongPath(level, c.x1, c.z1);
        expect(to - from).toBeCloseTo(Math.hypot(c.x1 - c.x0, c.z1 - c.z0), 0);
        for (let i = 0; i < path.length; i++) {
          if (cum[i] <= from + 0.5 || cum[i] >= to - 0.5) continue;
          expect(segmentDistance(path[i].x, path[i].z, c.x0, c.z0, c.x1, c.z1)).toBeLessThan(0.5);
        }
        const ramp = g.ramp!;
        expect(Math.hypot(ramp.x - c.x0, ramp.z - c.z0)).toBeCloseTo(R.ramp.runUp, 6);
        for (let t = 0; t <= 1; t += 0.05) {
          const x = c.x0 + (ramp.x - c.x0) * t;
          const z = c.z0 + (ramp.z - c.z0) * t;
          expect(-sampleField(level.ground, x, z)).toBeGreaterThanOrEqual(R.ramp.runUpDepth);
        }
        for (const s of level.solids) {
          expect(segmentDistance(s.x, s.z, c.x0, c.z0, c.x1, c.z1) - s.r).toBeGreaterThanOrEqual(
            c.halfWidth,
          );
        }
      }
    }
  });

  it("R10 — the course is a sprint inside the length band, and the path measures it", () => {
    for (const seed of LEVEL_SEEDS) {
      const { course } = levelFor(seed);
      expect(withinBand(course.length, R.course.length)).toBe(true);
      const cum = cumulative(course.path);
      expect(cum[cum.length - 1]).toBeCloseTo(course.length, 6);
      const finish = course.gates[course.gates.length - 1];
      const end = course.path[course.path.length - 1];
      expect(Math.hypot(finish.x - end.x, finish.z - end.z)).toBeLessThan(0.01);
    }
  });

  it("R11 — the start is 40 m behind gate 1, facing it, at the head of the path", () => {
    for (const seed of LEVEL_SEEDS) {
      const { start, course } = levelFor(seed);
      const first = course.gates[0];
      expect(Math.hypot(first.x - start.x, first.z - start.z)).toBeCloseTo(R.start.behind, 6);
      expect(Math.atan2(first.x - start.x, first.z - start.z)).toBeCloseTo(start.heading, 6);
      expect(first.heading).toBeCloseTo(start.heading, 6);
      expect(course.path[0]).toEqual({ x: start.x, z: start.z });
    }
  });

  it("R12 — the wind is inside its band and blows off the sea", () => {
    for (const seed of LEVEL_SEEDS) {
      const level = levelFor(seed);
      expect(withinBand(level.wind.speed, R.wind.speed)).toBe(true);
      // Blowing off the sea means that, taken over the whole coast, a
      // point upwind of the shore is further out to sea than a point
      // downwind of it. Over the WHOLE coast rather than at its middle
      // vertex: an inlet (R15) turns the shore round on itself, so the one
      // point the middle happens to land on says nothing about which way
      // the open water lies.
      const ux = Math.sin(level.wind.from);
      const uz = Math.cos(level.wind.from);
      let upwind = 0;
      let downwind = 0;
      const coast = level.shore.flat();
      for (let i = 0; i < coast.length; i += 5) {
        const p = coast[i];
        upwind += sampleField(level.offshore, p.x + ux * 60, p.z + uz * 60);
        downwind += sampleField(level.offshore, p.x - ux * 60, p.z - uz * 60);
      }
      expect(upwind).toBeGreaterThan(downwind);
    }
  });

  it("R13 — every level is ridden in daylight, in the biome's own water", () => {
    const taiga = biomeOf("taiga");
    const daylight = daylightWindow(taiga.latitude, R.day.minSun);
    if (!daylight) throw new Error("the taiga coast has daylight");
    for (const seed of LEVEL_SEEDS) {
      const level = levelFor(seed);
      expect(withinBand(level.hour, daylight, 0.05)).toBe(true);
      // The point of the rule, stated as the rider sees it: the sun is up.
      expect(sunAt(level.hour, taiga.latitude).elevation).toBeGreaterThanOrEqual(-1e-6);
      expect(level.water.density).toBe(taiga.water.density);
      expect(withinBand(level.water.temperature, taiga.water.temperature)).toBe(true);
    }
  });

  it("R19 — every level's sky is one the coast offers", () => {
    const taiga = biomeOf("taiga");
    for (const seed of LEVEL_SEEDS) {
      expect(taiga.weathers).toContain(levelFor(seed).weather);
    }
  });

  it("R14 — both grids sit on 4 m cells, and the bounds are the grid's edges, padded past the course", () => {
    for (const seed of LEVEL_SEEDS) {
      const { ground, offshore, bounds, course, solids } = levelFor(seed);
      expect(ground.cell).toBe(R.grid.cell);
      expect(offshore.cell).toBe(R.grid.cell);
      expect(ground.cols).toBe(offshore.cols);
      expect(ground.rows).toBe(offshore.rows);
      expect(ground.originX).toBe(bounds.minX);
      expect(ground.originZ).toBe(bounds.minZ);
      expect(ground.originX + (ground.cols - 1) * ground.cell).toBeCloseTo(bounds.maxX, 6);
      expect(ground.originZ + (ground.rows - 1) * ground.cell).toBeCloseTo(bounds.maxZ, 6);
      for (const p of course.path) {
        expect(bounds.maxX - p.x).toBeGreaterThanOrEqual(R.bounds.sea);
        expect(p.z - bounds.minZ).toBeGreaterThanOrEqual(R.bounds.sea);
        expect(p.x - bounds.minX).toBeGreaterThanOrEqual(R.bounds.land);
        expect(bounds.maxZ - p.z).toBeGreaterThanOrEqual(R.bounds.land);
      }
      for (const s of solids) {
        expect(s.x).toBeGreaterThanOrEqual(bounds.minX);
        expect(s.x).toBeLessThanOrEqual(bounds.maxX);
        expect(s.z).toBeGreaterThanOrEqual(bounds.minZ);
        expect(s.z).toBeLessThanOrEqual(bounds.maxZ);
      }
    }
  });

  it("R15 — the coastlines are the water's own edge, and the basin is a basin", () => {
    for (const seed of LEVEL_SEEDS) {
      const level = levelFor(seed);
      expect(level.shore.length).toBeGreaterThan(0);
      let longest = 0;
      for (const run of level.shore) {
        expect(run.length).toBeGreaterThanOrEqual(R.shore.minRun);
        let length = 0;
        for (let i = 0; i + 1 < run.length; i++) {
          // Every vertex of every coastline stands ON the water's edge: the
          // lines are traced out of the offshore field, so the field reads
          // zero along them to within the cell they were traced from.
          expect(Math.abs(sampleField(level.offshore, run[i].x, run[i].z))).toBeLessThan(
            R.grid.cell,
          );
          length += Math.hypot(run[i + 1].x - run[i].x, run[i + 1].z - run[i].z);
        }
        longest = Math.max(longest, length);
      }
      expect(longest).toBeGreaterThanOrEqual(ANALYSIS.shore.minLength);
      // …and the level is neither a canal cut through solid land nor an
      // open sea with a fleck of coast on one edge.
      let water = 0;
      for (const v of level.offshore.data) if (v > 0) water++;
      expect(withinBand(water / level.offshore.data.length, R.basin.waterShare)).toBe(true);
    }
  });

  it("R24 — the route is drawn first, and the course is laid on it", () => {
    for (const seed of LEVEL_SEEDS) {
      const level = levelFor(seed);
      const path = level.course.path;
      // The corridor was drawn round the line, so the line is inside R1's
      // band and over R5's water at every point of it — by construction
      // rather than by a search, which is the whole of the inversion.
      for (const p of path) {
        const off = sampleField(level.offshore, p.x, p.z);
        expect(off).toBeGreaterThanOrEqual(R.course.offshore.min);
        expect(off).toBeLessThanOrEqual(R.course.offshore.max);
      }
      // …and it never comes back on itself inside the clearance.
      const cum = cumulative(path);
      for (let i = 0; i < path.length; i++) {
        for (let j = i + 1; j < path.length; j++) {
          if (cum[j] - cum[i] < R.route.selfSpan) continue;
          expect(Math.hypot(path[j].x - path[i].x, path[j].z - path[i].z)).toBeGreaterThan(
            R.route.selfClear * 0.5,
          );
        }
      }
    }
  });

  it("R16 — the classifier calls water under the surface, sand only near the waterline, and every kind appears", () => {
    const seen = new Set<Surface>();
    for (const seed of LEVEL_SEEDS) {
      const level = levelFor(seed);
      const { bounds } = level;
      const n = 60;
      let wrongSide = 0;
      let highSand = 0;
      for (let i = 0; i <= n; i++) {
        for (let j = 0; j <= n; j++) {
          const x = bounds.minX + ((bounds.maxX - bounds.minX) * i) / n;
          const z = bounds.minZ + ((bounds.maxZ - bounds.minZ) * j) / n;
          const kind = level.materialAt(x, z);
          seen.add(kind);
          const h = sampleField(level.ground, x, z);
          if ((kind === "water") !== h < 0) wrongSide++;
          if (kind === "sand" && -sampleField(level.offshore, x, z) > R.surface.sand.reach)
            highSand++;
        }
      }
      expect(wrongSide).toBe(0);
      expect(highSand).toBe(0);
    }
    expect([...seen].sort()).toEqual(["bedrock", "rock", "sand", "water"]);
  });

  it("R17 — every rock is its kind, stands in its band, proud of the bed, apart from the rest", () => {
    for (const seed of LEVEL_SEEDS) {
      const level = levelFor(seed);
      const ids = new Set<string>();
      const kinds = new Set<string>();
      for (const s of level.solids) {
        expect(ids.has(s.id)).toBe(false);
        ids.add(s.id);
        kinds.add(s.kind);
        const rule = solidRule(s.kind);
        expect(withinBand(sampleField(level.offshore, s.x, s.z), rule.offshore, R.grid.cell)).toBe(
          true,
        );
        expect(withinBand(s.r, rule.r)).toBe(true);
        const ground = sampleField(level.ground, s.x, s.z);
        // A kind states its size against the sea or against the ground it
        // sits on, and it is held to the one it was placed by (R17).
        if (rule.height) expect(withinBand(s.top - ground, rule.height, 1)).toBe(true);
        else if (rule.top) expect(withinBand(s.top, rule.top)).toBe(true);
        expect(s.top).toBeGreaterThan(ground + R.solids.proud - 1);
        if (s.kind === "reef") expect(s.top).toBeLessThan(0);
        if (s.kind === "skerry") expect(s.top).toBeGreaterThan(0);
        // An erratic is a block on the SHORE: it breaks the surface,
        // whichever side of the waterline it came down on.
        if (s.kind === "erratic") expect(s.top).toBeGreaterThanOrEqual(R.solids.proud);
        for (const o of level.solids) {
          if (o === s) continue;
          expect(Math.hypot(o.x - s.x, o.z - s.z) - o.r - s.r).toBeGreaterThanOrEqual(
            R.solids.spacing - 1e-9,
          );
        }
      }
      expect([...kinds].sort()).toEqual(["boulder", "erratic", "reef", "skerry", "stack"]);
    }
  });

  it("is clean under its own analysis", () => {
    for (const seed of LEVEL_SEEDS) {
      const a = analysisFor(seed);
      expect(a.findings.filter((f) => f.severity === "error")).toEqual([]);
      expect(a.ok).toBe(true);
    }
  });

  it("generates a level well inside a second", () => {
    // Fresh seeds, so the corpus cache cannot answer for the clock.
    for (const seed of [5000, 5001, 5002]) {
      const started = performance.now();
      generateLevel(seed);
      expect(performance.now() - started).toBeLessThan(1000);
    }
  });
});
