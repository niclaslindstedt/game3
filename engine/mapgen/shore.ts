// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R15 — THE SHORE: the one line everything else in a level is measured
// from. The coast is drawn as an offset from a BASE LINE — a straight
// south-west-to-north-east heading through the world origin — so that
// "along the shore" (s, metres along the base line) and "out from it" (u,
// metres to the seaward side) are coordinates a search can walk in, and
// bays and headlands are a smooth, single-valued function u = offset(s)
// drawn from the seeded noise. The polyline is that function sampled every
// `shore.spacing` metres, and it is what the level publishes as `shore`.
//
// The open sea lies to the RIGHT of the base heading (south-east of a
// north-east coast, as on the Swedish side of the Bothnian Sea). Positive u
// is seaward; the frame's `right` vector is the engine's own right-of-
// heading (cos h, -sin h).
//
// `distanceAt` is the signed distance from a world point to the polyline —
// what `Level.offshore` is baked from, and what the search reads
// analytically before there is a grid. Positive at sea, negative on land,
// exactly zero on the line. Because the offset is single-valued and its
// slope is capped (`shore.maxSlope`), the nearest vertex to a point is
// never far from the vertex under the point's own s, and the search for it
// is a short window rather than the whole line.

import { clamp } from "../lib/math.ts";
import { valueNoise } from "../lib/noise.ts";
import type { Rng } from "../lib/prng.ts";
import { LEVEL_RULES as R, inBand } from "./rules.ts";
import type { Vec2 } from "./types.ts";

export type Shore = {
  /** Base heading, rad (engine convention: 0 = +z, clockwise). */
  readonly heading: number;
  /** Forward unit vector of the base line in the plan. */
  readonly fx: number;
  readonly fz: number;
  /** Seaward (right-of-heading) unit vector. */
  readonly nx: number;
  readonly nz: number;
  /** s of vertex 0 and the spacing between vertices, m. */
  readonly s0: number;
  readonly spacing: number;
  /** Seaward offset of each vertex from the base line, m. */
  readonly offsets: Float64Array;
  /** The vertices in world coordinates, s ascending — the published shore. */
  readonly points: readonly Vec2[];
  /** Plan coordinates along and out from the base line, m. */
  toLocal(x: number, z: number): { s: number; u: number };
  toWorld(s: number, u: number): { x: number; z: number };
  /** The shore's seaward offset at an s, m (linear between vertices). */
  offsetAt(s: number): number;
  /** How far the shore has receded inland at an s, m, 0 on a headland. */
  bayAt(s: number): number;
  /** Signed distance to the polyline, m, positive seaward. */
  distanceAt(x: number, z: number): number;
};

/** How far along the base line a course may run, m: the longest course the
 * band allows plus its start straight, which is the span the shore must be
 * drawn over before its margins are added. */
export function shoreSpan(): number {
  return R.course.length.max + R.start.behind + R.course.station;
}

/** Draw a shore from the seeded stream. Every number it needs comes off
 * `rng` in a fixed order, so the same sub-seed always draws the same coast. */
export function createShore(rng: Rng): Shore {
  const heading = inBand(rng, R.shore.heading);
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const nx = Math.cos(heading);
  const nz = -Math.sin(heading);
  const broadSeed = rng.int(1, 0x7fffffff);
  const fineSeed = rng.int(1, 0x7fffffff);
  // A coast that is not always the same size of bay: the amplitudes are
  // drawn as a share of the rule's, never above it, so the slope cap the
  // rule promises holds by construction and a strong seed is a bold coast.
  const broadAmp = R.shore.wander.broad.amplitude * rng.range(0.6, 1);
  const fineAmp = R.shore.wander.fine.amplitude * rng.range(0.5, 1);
  // Noise is sampled off the base line's own s, along a fixed lattice row:
  // one-dimensional value noise, keyed by the drawn seed.
  const offsetOf = (s: number): number =>
    (valueNoise(s, 0, R.shore.wander.broad.scale, broadSeed) - 0.5) * 2 * broadAmp +
    (valueNoise(s, 0, R.shore.wander.fine.scale, fineSeed) - 0.5) * 2 * fineAmp;

  const spacing = R.shore.spacing;
  const s0 = -R.shore.margin;
  const count = Math.ceil((shoreSpan() + 2 * R.shore.margin) / spacing) + 1;
  const offsets = new Float64Array(count);
  for (let i = 0; i < count; i++) offsets[i] = offsetOf(s0 + i * spacing);
  // R15's slope cap, held explicitly rather than trusted to the amplitudes:
  // a vertex further from its predecessor than the cap allows is pulled
  // back to it, in one forward pass, so the line never doubles back.
  const maxStep = R.shore.maxSlope * spacing;
  for (let i = 1; i < count; i++) {
    offsets[i] = clamp(offsets[i], offsets[i - 1] - maxStep, offsets[i - 1] + maxStep);
  }

  const toWorld = (s: number, u: number): { x: number; z: number } => ({
    x: s * fx + u * nx,
    z: s * fz + u * nz,
  });
  const toLocal = (x: number, z: number): { s: number; u: number } => ({
    s: x * fx + z * fz,
    u: x * nx + z * nz,
  });
  const points: Vec2[] = [];
  for (let i = 0; i < count; i++) points.push(toWorld(s0 + i * spacing, offsets[i]));

  const offsetAt = (s: number): number => {
    const f = clamp((s - s0) / spacing, 0, count - 1);
    const i = Math.min(Math.floor(f), count - 2);
    const t = f - i;
    return offsets[i] + (offsets[i + 1] - offsets[i]) * t;
  };
  const bayAt = (s: number): number => Math.max(0, -offsetAt(s));

  // The nearest point on the line lies within D·sin(φ) along s of the
  // query's own s, where D is the query's distance from the line and φ the
  // line's steepest angle to the base line — plus the wander itself, which
  // is what moves the line's s under a point. Rounded up generously: the
  // window is cheap, and a missed vertex is a wrong distance.
  const sinPhi = R.shore.maxSlope / Math.hypot(1, R.shore.maxSlope);
  const wanderReach = 2 * (R.shore.wander.broad.amplitude + R.shore.wander.fine.amplitude);
  const distanceAt = (x: number, z: number): number => {
    const s = x * fx + z * fz;
    const u = x * nx + z * nz;
    const rough = Math.abs(u - offsetAt(s));
    const window = Math.ceil((rough * sinPhi + wanderReach) / spacing) + 1;
    const centre = Math.round((s - s0) / spacing);
    const from = Math.max(0, centre - window);
    const to = Math.min(count - 2, centre + window);
    let best = Infinity;
    let sign = 1;
    for (let i = from; i <= to; i++) {
      const a = points[i];
      const b = points[i + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const px = x - a.x;
      const pz = z - a.z;
      const len2 = dx * dx + dz * dz;
      const t = clamp((px * dx + pz * dz) / len2, 0, 1);
      const qx = px - dx * t;
      const qz = pz - dz * t;
      const d2 = qx * qx + qz * qz;
      if (d2 < best) {
        best = d2;
        // Right of the segment's direction is seaward; the nearest point
        // of a smooth line puts the query on one side of every segment it
        // could be nearest to, so the sign of the winning one is the sign.
        sign = qx * dz - qz * dx >= 0 ? 1 : -1;
      }
    }
    return sign * Math.sqrt(best);
  };

  return {
    heading,
    fx,
    fz,
    nx,
    nz,
    s0,
    spacing,
    offsets,
    points,
    toLocal,
    toWorld,
    offsetAt,
    bayAt,
    distanceAt,
  };
}
