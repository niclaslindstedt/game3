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
// THE INLETS are what stop a level being a run down a straight beach. On
// top of the noise the coast carries a handful of rounded notches where the
// water reaches well inland, and because the course is laid at a distance
// from THIS line (course.ts), a notch is a corner the rider steers into and
// back out of rather than a feature in the distance. They are cosine
// notches rather than V-cuts on purpose: a cosine's ends and its head are
// both flat, so the coast leaves the open water smoothly and the head of an
// inlet is a rounded lagoon a course can turn round in, where a V would
// pinch to nothing before a hull could reach it.
//
// The offset is SINGLE-VALUED whatever it carries, which is what keeps the
// (s, u) frame a frame at all; `shore.maxSlope` is what holds that, and it
// is applied, smoothed and applied again so the line is left without a
// corner in it.
//
// The open sea lies to the RIGHT of the base heading (south-east of a
// north-east coast, as on the Swedish side of the Bothnian Sea). Positive u
// is seaward; the frame's `right` vector is the engine's own right-of-
// heading (cos h, -sin h).
//
// R21 — the coast also carries a CHARACTER along the same s: `ruggedAt` is
// a second, much slower noise saying how hard this stretch of shore is, and
// the ground, the classifier and the placer all read it. It lives here
// because it is a property of the LINE rather than of a point in the world:
// everything on one stretch — the hill behind it, the beach on it, the
// blocks strewn over it — has to agree, and the only way it can is by
// asking one function of one coordinate.
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
  /** R21 — how RUGGED the coast is at an s, 0..1: 0 a soft bay behind a
   * beach, 1 a bare rock headland. */
  ruggedAt(s: number): number;
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
  const characterSeed = rng.int(1, 0x7fffffff);
  const detailSeed = rng.int(1, 0x7fffffff);
  // A coast that is not always the same size of bay: the amplitudes are
  // drawn as a share of the rule's, never above it, so the slope cap the
  // rule promises holds by construction and a strong seed is a bold coast.
  const broadAmp = R.shore.wander.broad.amplitude * rng.range(0.6, 1);
  const fineAmp = R.shore.wander.fine.amplitude * rng.range(0.5, 1);
  // Noise is sampled off the base line's own s, along a fixed lattice row:
  // one-dimensional value noise, keyed by the drawn seed.
  // R15 — the inlets, drawn before the line is sampled so they are part of
  // the same single-valued function as the wander. Each is placed anywhere
  // along the stretch the level will use, at the mouth width its own depth
  // needs.
  const span = shoreSpan();
  const inlets: { at: number; depth: number; half: number }[] = [];
  const inletCount = rng.int(R.shore.inlet.count.min, R.shore.inlet.count.max);
  // One to a SLOT along the stretch the course will use, jittered inside
  // it, rather than anywhere on the line. Placed at random, a level draws
  // two inlets into the same headland and none where the course runs — and
  // an inlet the path never reaches is a bay in the distance rather than a
  // corner anybody steers round.
  const slot = span / inletCount;
  for (let i = 0; i < inletCount; i++) {
    const at = (i + 0.5) * slot + rng.range(-0.28, 0.28) * slot;
    const depth = inBand(rng, R.shore.inlet.depth);
    const drawn = inBand(rng, R.shore.inlet.half);
    // Two floors on the mouth, and the wider wins: the SIDES may not run
    // steeper than the slope cap (or the cap would only flatten them
    // again), and the HEAD may not turn tighter than the course can hold
    // round the inside of it (R23).
    const sides = (depth * Math.PI) / (2 * R.shore.maxSlope * R.shore.inlet.steep);
    const head = Math.PI * Math.sqrt((depth * (R.shore.inlet.turn + R.course.aim.min)) / 2);
    inlets.push({ at, depth, half: Math.max(drawn, sides, head) });
  }
  /** How far the water reaches inland at an s, m — the sum of whatever
   * inlets cover it. Cosine notches: zero slope at both ends and at the
   * head, so an inlet has a mouth and a lagoon rather than a corner. */
  const inletAt = (s: number): number => {
    let cut = 0;
    for (const n of inlets) {
      const d = Math.abs(s - n.at);
      if (d >= n.half) continue;
      cut += n.depth * 0.5 * (1 + Math.cos((Math.PI * d) / n.half));
    }
    return cut;
  };
  /** The coast's BROAD lie at an s, m — the long swing between bay and
   * headland with neither the fine grain nor the inlets on it. Whether a
   * stretch is sheltered is a fact about the shape of the coast over
   * hundreds of metres, so this rather than the finished offset is what
   * R21's character reads: an inlet's own wall runs at the slope cap, and
   * a ruggedness that followed it would swing from bay to headland over
   * thirty metres and take the hill behind it along. */
  const broadAt = (s: number): number =>
    (valueNoise(s, 0, R.shore.wander.broad.scale, broadSeed) - 0.5) * 2 * broadAmp;
  const offsetOf = (s: number): number =>
    broadAt(s) +
    (valueNoise(s, 0, R.shore.wander.fine.scale, fineSeed) - 0.5) * 2 * fineAmp -
    inletAt(s);

  const spacing = R.shore.spacing;
  const s0 = -R.shore.margin;
  const count = Math.ceil((span + 2 * R.shore.margin) / spacing) + 1;
  const offsets = new Float64Array(count);
  for (let i = 0; i < count; i++) offsets[i] = offsetOf(s0 + i * spacing);
  // R15's slope cap, held explicitly rather than trusted to the amplitudes:
  // a vertex further from its predecessor than the cap allows is pulled
  // back to it, in one forward pass, so the line never doubles back. The
  // pass leaves a CORNER wherever it lets go, so the line is rounded once
  // and capped again — the second pass has almost nothing to do, and what
  // it does have to do is what the smoothing would otherwise have undone.
  const maxStep = R.shore.maxSlope * spacing;
  const cap = (): void => {
    for (let i = 1; i < count; i++) {
      offsets[i] = clamp(offsets[i], offsets[i - 1] - maxStep, offsets[i - 1] + maxStep);
    }
  };
  cap();
  const rounded = Float64Array.from(offsets);
  for (let i = 1; i + 1 < count; i++) {
    offsets[i] = (rounded[i - 1] + 2 * rounded[i] + rounded[i + 1]) / 4;
  }
  cap();

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
  // R21 — the noise says what this stretch would be on a straight coast;
  // the coast's own LIE then softens a bay and hardens a headland, because
  // the sediment a headland is stripped of is the sediment a bay collects.
  const character = R.shore.character;
  const ruggedAt = (s: number): number => {
    const broad = (valueNoise(s, 0, character.scale, characterSeed) - 0.5) * 2;
    const fine = (valueNoise(s, 0, character.detail.scale, detailSeed) - 0.5) * 2;
    const grain = broad * (1 - character.detail.share) + fine * character.detail.share;
    const lie = clamp(broadAt(s) / character.swing, -1, 1);
    return clamp(character.bias + character.grain * grain + character.shelter * lie, 0, 1);
  };

  // The window the nearest vertex must be in, EXACTLY: the point of the
  // line at the query's own s is already `rough` away, so no point further
  // than `rough` can win — and s is a projection onto a unit vector, so a
  // point within `rough` of the query is within `rough` of it in s as well.
  // Two vertices of slack cover the segment either candidate lies on.
  //
  // Bounding it by the wander's own amplitude instead would be correct and
  // ruinous: a coast with a two-hundred-metre inlet in it would search
  // fifty vertices for every one of the hundreds of thousands of cells the
  // compiler bakes, and this lookup IS the cost of building a level.
  const distanceAt = (x: number, z: number): number => {
    const s = x * fx + z * fz;
    const u = x * nx + z * nz;
    const rough = Math.abs(u - offsetAt(s));
    const window = Math.ceil(rough / spacing) + 2;
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
    ruggedAt,
    distanceAt,
  };
}
