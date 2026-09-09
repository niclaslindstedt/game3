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
import { angleDiff } from "../lib/math.ts";
import { LEVEL_RULES as R, solidRule, withinBand } from "../mapgen/rules.ts";
import type { Level, Solid } from "../mapgen/types.ts";
import { ANALYSIS as A } from "./budgets.ts";
import { bandText, fmt, type Report } from "./report.ts";

/** The compass heading the open sea lies in, from the published shore:
 * right of the line's overall direction. Undefined for a degenerate line. */
export function shoreSeaward(level: Level): number | undefined {
  const pts = level.shore;
  if (pts.length < 2) return undefined;
  const a = pts[0];
  const b = pts[pts.length - 1];
  return Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2;
}

export function analyzeShore(
  level: Level,
  rep: Report,
  offshoreAt: (x: number, z: number) => number,
): void {
  const pts = level.shore;
  if (pts.length < 3) {
    rep.fail("R15", "line", `the shore has ${pts.length} vertices`);
    return;
  }
  const base = Math.atan2(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].z - pts[0].z);
  if (!withinBand(base, R.shore.heading, A.shore.turn)) {
    rep.fail(
      "R15",
      "heading",
      `the shore runs at ${fmt((base * 180) / Math.PI)}° (band ${fmt((R.shore.heading.min * 180) / Math.PI)}–${fmt((R.shore.heading.max * 180) / Math.PI)}°)`,
      {
        value: base,
      },
    );
  }
  let worst = 0;
  for (let i = 1; i + 1 < pts.length; i++) {
    const h0 = Math.atan2(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    const h1 = Math.atan2(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z);
    worst = Math.max(worst, Math.abs(angleDiff(h0, h1)));
  }
  if (worst > A.shore.turn) {
    rep.fail("R15", "smooth", `the shore turns ${fmt((worst * 180) / Math.PI)}° at a vertex`, {
      value: worst,
    });
  }
  // The sea is on the RIGHT: a point a little right of the line's middle
  // reads as offshore, a point left of it as land.
  const mid = pts[Math.floor(pts.length / 2)];
  const rx = Math.cos(base);
  const rz = -Math.sin(base);
  const probe = 3 * R.grid.cell;
  if (
    offshoreAt(mid.x + rx * probe, mid.z + rz * probe) <= 0 ||
    offshoreAt(mid.x - rx * probe, mid.z - rz * probe) >= 0
  ) {
    rep.fail("R15", "side", `the sea is not on the right of the shore`, { at: mid });
  }
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
 * R21 — THE COAST IS A QUILT: walk the waterline and see how it changes.
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
  const runs = new Map<string, number>();
  let longest = 0;
  let longestKind = "";
  let walked = 0;
  let sand = 0;
  let current = "";
  let run = 0;
  let at: { x: number; z: number } | undefined;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) continue;
    // The sea is on the RIGHT of the line (R15), so the shore itself is to
    // the LEFT; the probe stands far enough in to be past the cells the
    // zero contour is drawn through.
    const ix = (-dz / len) * A.shore.probe;
    const iz = (dx / len) * A.shore.probe;
    for (let d = 0; d < len; d += A.shore.walk) {
      const t = d / len;
      const x = a.x + dx * t + ix;
      const z = a.z + dz * t + iz;
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
  const rule = solidRule(s.kind);
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
