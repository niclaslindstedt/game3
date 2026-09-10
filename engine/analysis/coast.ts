// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R15, R16, R17, R21 — THE COAST, re-checked. The other half of
// `analyzeLevel`: everything the analysis asks about the SHORE and what
// stands on it, as against the course laid along it.
//
// Split from `index.ts` by subject rather than by size: these four read the
// shore polyline, the surface classifier and the solids, and none of them
// knows a gate exists. They take the same `Report` and are called in rule
// order from `analyzeLevel`, so the split is invisible in the findings.

import { sampleField } from "../lib/heightfield.ts";
import { fieldGradient } from "../lib/heightfield.ts";
import { LEVEL_RULES as R, solidRule, withinBand } from "../mapgen/rules.ts";
import type { Bounds, Level, Solid } from "../mapgen/types.ts";
import { ANALYSIS as A } from "./budgets.ts";
import { bandText, fmt, type Report } from "./report.ts";

/**
 * The compass heading the OPEN SEA lies in, read off the level itself.
 *
 * There is no base line to take a normal to any more — a basin's coast
 * doubles back and carries islands — so this reads the offshore field's own
 * gradient, which points the way the water deepens.
 *
 * Summed over the OPEN water only. Inside the basin every channel has its
 * own two banks and its gradients point at each other; they cancel, and
 * what is left is noise. Past the shelf's reach there is only one thing
 * left for the field to grow toward, and every cell out there agrees.
 */
export function shoreSeaward(level: Level): number | undefined {
  const { offshore } = level;
  const { cols, rows, cell, originX, originZ } = offshore;
  let gx = 0;
  let gz = 0;
  for (let r = 1; r + 1 < rows; r += 2) {
    for (let c = 1; c + 1 < cols; c += 2) {
      if (offshore.data[r * cols + c] < R.sea.shelf.reach) continue;
      const g = fieldGradient(offshore, originX + c * cell, originZ + r * cell);
      gx += g.gx;
      gz += g.gz;
    }
  }
  return Math.hypot(gx, gz) < 1e-9 ? undefined : Math.atan2(gx, gz);
}

/**
 * R15 — THE WATER IS A BASIN, and this is what that has to come out as.
 *
 * The old checks here were about a LINE: which way it ran, how sharply it
 * turned, which side the sea was on. None of them survives the basin —
 * there is no line, there are coastlines, one of them round each island,
 * and the water reaches inland wherever the route went. What is left to
 * hold is what a basin has to be: a coast with real length to it, and water
 * that is neither a canal cut through solid land nor an open sea with a
 * fleck of coast on one edge.
 */
export function analyzeShore(level: Level, rep: Report): void {
  const coasts = level.shore;
  if (coasts.length === 0) {
    rep.fail("R15", "line", `the level has no coastline`);
    return;
  }
  let longest = 0;
  for (const line of coasts) {
    let run = 0;
    for (let i = 0; i + 1 < line.length; i++) {
      run += Math.hypot(line[i + 1].x - line[i].x, line[i + 1].z - line[i].z);
    }
    longest = Math.max(longest, run);
  }
  if (longest < A.shore.minLength) {
    rep.fail("R15", "coast", `the longest coastline is ${fmt(longest)} m`, { value: longest });
  }
  // THE SHARE, over the box the RACE is in rather than over the level's.
  // R26 carries the level a kilometre inland along a creek, and the country
  // either side of that creek is land nobody was ever going to ride: counted
  // in, every basin reads as a canal and the rule stops being about the
  // water the race is in at all — which is the only thing it was ever
  // about.
  //
  // R29 — a circuit inverts that. Its race box holds no land at all by
  // construction (the line stands past every shore), so the question the
  // share can still answer there is the level's own: is there a coast in
  // this level, and has it grown over the sea the race needs? Measured over
  // the whole level, against the circuit's own band.
  const circuit = level.track === "circuit";
  const box = circuit ? level.bounds : raceBox(level);
  let water = 0;
  let cells = 0;
  const o = level.offshore;
  for (let r = 0; r < o.rows; r++) {
    const z = o.originZ + r * o.cell;
    if (z < box.minZ || z > box.maxZ) continue;
    for (let c = 0; c < o.cols; c++) {
      const x = o.originX + c * o.cell;
      if (x < box.minX || x > box.maxX) continue;
      cells++;
      if (o.data[r * o.cols + c] > 0) water++;
    }
  }
  const share = cells > 0 ? water / cells : 0;
  const band = circuit ? R.circuit.waterShare : R.basin.waterShare;
  if (!withinBand(share, band)) {
    rep.fail(
      "R15",
      "share",
      `${fmt(share * 100)}% of the level is water (band ${fmt(band.min * 100)}–${fmt(band.max * 100)}%)`,
      { value: share },
    );
  }
}

/** The box the RACE is in: the course's own extent, opened out by R1's
 * ceiling so the water either side of the line is inside it and the country
 * behind that is not. What R15's share and R21's quilt are measured over,
 * because both are rules about where the rider is. */
function raceBox(level: Level): Bounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of level.course.path) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  const pad = R.course.offshore.max;
  return { minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad };
}

export function analyzeSurface(level: Level, rep: Report): void {
  const { bounds } = level;
  const n = A.surfaceSamples;
  let wrong = 0;
  let at: { x: number; z: number } | undefined;
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      const x = bounds.minX + ((bounds.maxX - bounds.minX) * i) / n;
      const z = bounds.minZ + ((bounds.maxZ - bounds.minZ) * j) / n;
      const h = sampleField(level.ground, x, z);
      const kind = level.materialAt(x, z);
      if ((kind === "water") !== h < 0) {
        wrong++;
        at ??= { x, z };
      }
    }
  }
  if (wrong > 0)
    rep.fail("R16", "water", `${wrong} samples call the wrong side of the waterline water`, {
      at,
      value: wrong,
    });
}

/**
 * R21 — THE COAST IS A QUILT: walk every coastline and see how it changes.
 *
 * The material a few metres in from the line is what the rider actually
 * looks at all run — the bare rock of a headland, the boulder field behind
 * it, the sand of a bay — and the fault this is here to catch is a coast
 * that is one of them from the start gate to the finish. Measured along the
 * SHORE rather than over the box, because most of a level's ground is
 * plateau nobody is ever near.
 */
export function analyzeCharacter(level: Level, rep: Report): number {
  const pts = level.shore;
  // …and only the waterline the RIDER is ever near (R26): the banks of a
  // creek a kilometre up the country are a coast nobody looks at from a
  // saddle, and a rule about how a coast CHANGES cannot be read off one.
  //
  // R29 — on a circuit the whole waterline is the coast the rider looks at:
  // there is one, it stands off on one side of the loop, and it is in view
  // from every corner of the lap. Nothing to exclude.
  const box = raceBox(level);
  const near = (x: number, z: number): boolean =>
    level.track === "circuit" ||
    (x >= box.minX - A.shore.race &&
      x <= box.maxX + A.shore.race &&
      z >= box.minZ - A.shore.race &&
      z <= box.maxZ + A.shore.race);
  const runs = new Map<string, number>();
  let longest = 0;
  let longestKind = "";
  let walked = 0;
  let sand = 0;
  let current = "";
  let run = 0;
  let at: { x: number; z: number } | undefined;
  for (const line of pts) {
    for (let i = 0; i + 1 < line.length; i++) {
      const a = line[i];
      const b = line[i + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      if (len < 1e-6) continue;
      for (let d = 0; d < len; d += A.shore.walk) {
        const t = d / len;
        const on = { x: a.x + dx * t, z: a.z + dz * t };
        if (!near(on.x, on.z)) {
          current = "";
          run = 0;
          continue;
        }
        // INLAND is down the offshore field's own gradient — the field
        // grows toward the water, so away from it is into the land. There
        // is no "left of the line" any more: an island's coast has the
        // land on whichever side the island is.
        const g = fieldGradient(level.offshore, on.x, on.z);
        const glen = Math.hypot(g.gx, g.gz);
        if (glen < 1e-9) continue;
        const x = on.x - (g.gx / glen) * A.shore.probe;
        const z = on.z - (g.gz / glen) * A.shore.probe;
        const kind = level.materialAt(x, z);
        if (kind === "water") continue;
        walked += A.shore.walk;
        if (kind === "sand") sand += A.shore.walk;
        runs.set(kind, (runs.get(kind) ?? 0) + A.shore.walk);
        if (kind === current) run += A.shore.walk;
        else {
          current = kind;
          run = A.shore.walk;
        }
        if (run > longest) {
          longest = run;
          longestKind = kind;
          at = { x, z };
        }
      }
    }
  }
  if (walked <= 0) return 0;
  if (longest > R.shore.character.run) {
    rep.fail(
      "R21",
      "quilt",
      `${fmt(longest)} m of the waterline is unbroken ${longestKind} (rule ${R.shore.character.run} m)`,
      { at, value: longest },
    );
  }
  if (runs.size < 2) {
    rep.smell("R21", "plain", `the whole waterline is ${[...runs.keys()][0]}`, { value: 1 });
  }
  return sand / walked;
}

export function analyzeSolid(
  level: Level,
  s: Solid,
  offshoreAt: (x: number, z: number) => number,
  depthAt: (x: number, z: number) => number,
  rep: Report,
): void {
  const rule = solidRule(s.kind, level.track);
  const off = offshoreAt(s.x, s.z);
  if (!withinBand(off, rule.offshore, R.grid.cell)) {
    rep.fail(
      "R17",
      "offshore",
      `${s.id} (${s.kind}) stands ${fmt(off)} m from the shore (band ${bandText(rule.offshore)} m)`,
      { at: s, value: off },
    );
  }
  if (!withinBand(s.r, rule.r))
    rep.fail("R17", "radius", `${s.id} has radius ${fmt(s.r)} m (band ${bandText(rule.r)} m)`, {
      at: s,
    });
  const bed = -depthAt(s.x, s.z);
  // A kind states its size against the sea or against the ground it sits
  // on, and the check is the one the kind was placed by (R17).
  if (rule.height) {
    if (!withinBand(s.top - bed, rule.height, A.sea.tolerance)) {
      rep.fail(
        "R17",
        "height",
        `${s.id} stands ${fmt(s.top - bed)} m over the ground (band ${bandText(rule.height)} m)`,
        { at: s, value: s.top - bed },
      );
    }
  } else if (rule.top && !withinBand(s.top, rule.top)) {
    rep.fail("R17", "top", `${s.id}'s top is at ${fmt(s.top)} m (band ${bandText(rule.top)} m)`, {
      at: s,
    });
  }
  if (s.top < bed + R.solids.proud - A.sea.tolerance) {
    rep.fail("R17", "proud", `${s.id}'s top is under the bed`, { at: s, value: s.top - bed });
  }
  for (const other of level.solids) {
    if (other.id <= s.id) continue;
    const gap = Math.hypot(other.x - s.x, other.z - s.z) - other.r - s.r;
    if (gap < R.solids.spacing - A.distance) {
      rep.fail(
        "R17",
        "spacing",
        `${s.id} and ${other.id} are ${fmt(gap)} m apart (rule ${R.solids.spacing} m)`,
        { at: s, value: gap },
      );
    }
  }
}
