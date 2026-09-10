// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FETCH — how far the wind has blown over water to get here, and what
// that buys. One module, because every question this game asks about the
// difference between the OPEN SEA and a river is the same question:
//
//   Out at sea the wind has crossed an ocean, so it is blowing its full
//   strength and it has grown a full sea. Ten metres up a creek it has
//   crossed ten metres of water and a kilometre of forest, so it is a
//   third of itself and it has grown a ripple. The shore between them is
//   the sea's, not the river's: with an ONSHORE wind (R12) a point a few
//   metres off the beach has the whole ocean upwind of it, which is why
//   the waves come INTO the shore and do not come down the river.
//
// Two things are read off one measurement:
//
// - THE GROWTH LAWS. SPM (1984)'s fetch-limited significant height and
//   peak period, capped at the fully developed Pierson-Moskowitz (1964)
//   sea. They are stated here rather than in `water.ts` because they are
//   what a FETCH means, and both the sea and the wind ask them.
// - THE FIELD. For a level and a wind, `createShelter` bakes what every
//   point of it has upwind: how much of the open sea it can see, how much
//   water the wind crossed to reach it, how much of the mean wind is left
//   by the time it gets there, and the chop that wind grows on that water.
//
// HOW THE FIELD IS MEASURED. SPM's EFFECTIVE FETCH (Saville): the reach
// over water is read on a fan of rays upwind, ±`sea.fanSpread` about the
// wind, and averaged with cos weights — because a narrow body of water
// gives the wind a different run at every angle and one ray up the middle
// cannot say so. Each ray is not marched per point; it is a SWEEP over the
// whole grid in that ray's direction, one cell at a time, each cell
// reading its two upwind neighbours — the same upwind scheme the wave
// model's phase field is integrated with (`buildPhaseField`), at the same
// O(cells) cost per direction. Land resets a run to nothing, so shelter
// falls away behind a headland and up a channel on its own, and the
// lateral half of the scheme is a cheap stand-in for the way a little wind
// (and a little wave) does get in round the corner.
//
// WHERE THE OCEAN IS. A run that reaches the EDGE of the level still over
// water is a run that carries on into the open sea, and that is the whole
// definition: the basin cuts its open water off at a straight line and
// pads every other side with land (R14, R15), so the only water at the
// grid's rim is the sea's. What lies beyond it is the fiction the wave
// model has always run on — this coast is a piece of a longer one, and the
// fetch out there is `sea.baseFetch`, not the six hundred metres the
// bounds happen to hold.
//
// Deterministic: no randomness, and no clock. A level and a wind give one
// field.

import { createHeightfield, sampleField, type Heightfield } from "../lib/heightfield.ts";
import { clamp } from "../lib/math.ts";
import type { Level, Wind } from "../mapgen/types.ts";
import { TUNING } from "./defs/tuning.ts";

const S = TUNING.sea;
const W = TUNING.wind;
const G = TUNING.g;

/** Significant wave height, m, for a wind `u` (m/s at 10 m) over a fetch
 * `fetch` (m): SPM (1984) fetch-limited law capped at the fully developed
 * Pierson–Moskowitz (1964) sea, Hs = 0.21·U²/g. */
export function fetchHeight(u: number, fetch: number): number {
  if (u <= 0) return 0;
  const dimless = (G * Math.max(fetch, 0)) / (u * u);
  const limited = (1.6e-3 * Math.sqrt(dimless) * u * u) / G;
  const developed = (0.21 * u * u) / G;
  return Math.min(limited, developed);
}

/** Peak period, s, for the same wind and fetch: the SPM law capped at the
 * Pierson–Moskowitz peak (ω_p = 0.877·g/U). */
export function fetchPeriod(u: number, fetch: number): number {
  if (u <= 0) return 1;
  const dimless = (G * Math.max(fetch, 0)) / (u * u);
  const limited = (0.286 * Math.cbrt(dimless) * u) / G;
  const developed = ((2 * Math.PI) / 0.877) * (u / G);
  return Math.max(0.6, Math.min(limited, developed));
}

/** The OCEAN fetch a point of open water is quoted at, m: the fiction's
 * long coast plus the level's own metres, stretched (`sea.fetchScale`).
 * `reach` is the effective fetch measured INSIDE the level. */
export function effectiveFetch(reach: number): number {
  return S.baseFetch + S.fetchScale * Math.max(reach, 0);
}

export type Shelter = {
  /** The wind it was measured for. */
  readonly windSpeed: number;
  readonly windFrom: number;
  /** 0..1 on the level's own grid — how much of the upwind fan reaches the
   * open sea. The OCEAN band's amplitude share: 1 out at sea and off an
   * exposed beach, 0 up a river. */
  readonly exposure: Heightfield;
  /** m, on the same grid — the effective fetch over the water INSIDE the
   * level. What is left of a run once land has cut it, before the ocean
   * beyond the rim is added. */
  readonly reach: Heightfield;
  /** 0..1 on the same grid — the LOCAL wind chop's height as a share of
   * the level's own quoted chop (`sea.localFetch` at the mean wind). */
  readonly chop: Heightfield;
  /** 0..1 on `wind.cell` cells — what the mean wind speed is multiplied by
   * at a point. */
  readonly shelter: Heightfield;
  /** The reach and the shelter where the RACE is ridden — the mean over
   * the course's gates, which is what the two bands are quoted at. */
  readonly reachRef: number;
  readonly shelterRef: number;
};

/** How much of the mean wind is left at a point that can see `exposure` of
 * the open sea across `reach` metres of its own water: the floor a wind
 * that has crossed only land keeps, recovering toward the full mean over
 * `wind.shelterFetch` of open water. */
function shelterOf(exposure: number, reach: number): number {
  const grown = Math.max(exposure, 1 - Math.exp(-Math.max(reach, 0) / W.shelterFetch));
  return W.shelter + (1 - W.shelter) * clamp(grown, 0, 1);
}

/** One ray of the fan: sweep the whole grid downwind along `toward`,
 * writing each cell's over-water run (m) into `run` and whether that run
 * traces back to the open sea into `open` (0..1).
 *
 * The cells are visited in the ray's own order, so a cell's two upwind
 * neighbours are already written when it is read; the two are mixed by the
 * ray's direction cosines, which is the standard upwind scheme and also
 * the reason shelter softens sideways instead of casting a hard shadow. */
function sweep(water: Heightfield, toward: number, run: Float32Array, open: Float32Array): void {
  const { cols, rows, cell, data } = water;
  const dx = Math.sin(toward);
  const dz = Math.cos(toward);
  const ax = Math.abs(dx);
  const az = Math.abs(dz);
  const sx = dx >= 0 ? 1 : -1;
  const sz = dz >= 0 ? 1 : -1;
  const step = cell / (ax + az);
  for (let i = 0; i < rows; i++) {
    const r = sz > 0 ? i : rows - 1 - i;
    for (let j = 0; j < cols; j++) {
      const c = sx > 0 ? j : cols - 1 - j;
      const at = r * cols + c;
      // Land: a run of nothing, and no sight of the sea. Everything the
      // field does downwind of a bank falls out of this one line.
      if (data[at] < 0) {
        run[at] = 0;
        open[at] = 0;
        continue;
      }
      const cu = c - sx;
      const ru = r - sz;
      // Water at the rim of the level is the OPEN SEA, and what is upwind
      // of it is the ocean the fiction puts there.
      if (cu < 0 || cu >= cols || ru < 0 || ru >= rows) {
        run[at] = step;
        open[at] = 1;
        continue;
      }
      const col = r * cols + cu;
      const row = ru * cols + c;
      run[at] = (ax * run[col] + az * run[row]) / (ax + az) + step;
      open[at] = (ax * open[col] + az * open[row]) / (ax + az);
    }
  }
}

/** Grow the water's own values one cell into the land around it, `passes`
 * times. Nothing reads these fields ashore — but everything reads them
 * BILINEARLY, and a sample taken in the last metres before a beach mixes
 * the water's cell with the land's. Undone, that is a sea that fades out
 * exactly where R12's wind is driving it hardest. */
function dilate(field: Heightfield, water: Heightfield, passes: number): void {
  const { cols, rows, data } = field;
  const wet = water.data;
  for (let pass = 0; pass < passes; pass++) {
    const before = data.slice();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const at = r * cols + c;
        if (wet[at] >= 0) continue;
        let best = before[at];
        if (c > 0) best = Math.max(best, before[at - 1]);
        if (c + 1 < cols) best = Math.max(best, before[at + 1]);
        if (r > 0) best = Math.max(best, before[at - cols]);
        if (r + 1 < rows) best = Math.max(best, before[at + cols]);
        data[at] = best;
      }
    }
  }
}

/** The mean over the course's gates of a field — the water the level is
 * actually ridden in, which is what both wave bands are quoted at. Falls
 * back to the middle of the level for a course with no gates. */
function overCourse(level: Level, read: (x: number, z: number) => number): number {
  const gates = level.course.gates;
  if (gates.length === 0) {
    const { bounds } = level;
    return read((bounds.minX + bounds.maxX) / 2, (bounds.minZ + bounds.maxZ) / 2);
  }
  let sum = 0;
  for (const g of gates) sum += read(g.x, g.z);
  return sum / gates.length;
}

/** Measure a level against a wind. */
export function createShelter(level: Level, wind: Wind = level.wind): Shelter {
  const water = level.offshore;
  const { originX, originZ, cell, cols, rows } = water;
  const n = cols * rows;
  const exposure = createHeightfield(originX, originZ, cell, cols, rows);
  const reach = createHeightfield(originX, originZ, cell, cols, rows);
  const chop = createHeightfield(originX, originZ, cell, cols, rows);

  // ── The fan ───────────────────────────────────────────────────────────
  // Waves and wind travel WITH the wind: `from` is where it blows from.
  const toward = wind.from + Math.PI;
  const run = new Float32Array(n);
  const open = new Float32Array(n);
  const rays = Math.max(1, S.fanRays);
  let sumCos = 0;
  let sumCos2 = 0;
  for (let k = 0; k < rays; k++) {
    const theta = rays === 1 ? 0 : -S.fanSpread + (2 * S.fanSpread * k) / (rays - 1);
    const w = Math.cos(theta);
    const w2 = w * w;
    sumCos += w;
    sumCos2 += w2;
    sweep(water, toward + theta, run, open);
    for (let i = 0; i < n; i++) {
      reach.data[i] += w2 * run[i];
      exposure.data[i] += w2 * open[i];
    }
  }
  // SPM's effective fetch is Σ(X·cos²θ) / Σ(cos θ); the exposure is a
  // SHARE, so it is normalised by its own weights instead.
  for (let i = 0; i < n; i++) {
    reach.data[i] /= sumCos;
    exposure.data[i] /= sumCos2;
  }

  // ── The wind ──────────────────────────────────────────────────────────
  // Averaged onto `wind.cell` squares, land and water together: that
  // mixture IS what a hundred metres of coast does to a wind, and a field
  // this coarse read back bilinearly is one a rider drifts through rather
  // than crosses.
  const shelter = coarsen(water, W.cell, (i) => shelterOf(exposure.data[i], reach.data[i]));

  // ── The chop ──────────────────────────────────────────────────────────
  // The local band's share at every point: the sheltered wind over the
  // point's own water, against the level's one quoted chop.
  const quoted = fetchHeight(wind.speed, S.localFetch);
  if (quoted > 0) {
    for (let r = 0; r < rows; r++) {
      const z = originZ + r * cell;
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const u = wind.speed * sampleField(shelter, originX + c * cell, z);
        chop.data[i] = fetchHeight(u, S.localFetchScale * reach.data[i]) / quoted;
      }
    }
  }

  // The two the SEA reads are read at the water's edge as well as in it.
  dilate(exposure, water, 2);
  dilate(chop, water, 2);

  const shelterAt = (x: number, z: number): number => sampleField(shelter, x, z);
  return {
    windSpeed: wind.speed,
    windFrom: wind.from,
    exposure,
    reach,
    chop,
    shelter,
    reachRef: overCourse(level, (x, z) => sampleField(reach, x, z)),
    shelterRef: overCourse(level, shelterAt),
  };
}

/** A field on `size`-metre cells over the same ground as `like`, each node
 * the mean of the fine cells in the square around it. */
function coarsen(like: Heightfield, size: number, read: (i: number) => number): Heightfield {
  const span = Math.max(1, Math.round(size / like.cell));
  const cols = Math.max(2, Math.ceil((like.cols - 1) / span) + 1);
  const rows = Math.max(2, Math.ceil((like.rows - 1) / span) + 1);
  const out = createHeightfield(like.originX, like.originZ, span * like.cell, cols, rows);
  const half = span >> 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let sum = 0;
      let count = 0;
      for (let dr = -half; dr <= half; dr++) {
        const fr = r * span + dr;
        if (fr < 0 || fr >= like.rows) continue;
        for (let dc = -half; dc <= half; dc++) {
          const fc = c * span + dc;
          if (fc < 0 || fc >= like.cols) continue;
          sum += read(fr * like.cols + fc);
          count++;
        }
      }
      out.data[r * cols + c] = count > 0 ? sum / count : 0;
    }
  }
  return out;
}
