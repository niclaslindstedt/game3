// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE BED DOES TO A WAVE — the half of the wave model that reads
// `level.ground` rather than the wind.
//
// A component is laid once from the spectrum (`water.ts`) and then has to
// answer the same three questions at every point it is sampled at: how long
// is it in this depth, how much has the shoaling grown it, and how fast is
// the water under the surface going round. This module is all three, plus
// the field that says WHERE in the wave a point is:
//
//   `wavenumber`      linear dispersion, ω² = g·k·tanh(k·d) — the wave
//                     shortening and slowing as it comes ashore.
//   `shoaling`        the linear-theory coefficient K_s = √(c_g,deep / c_g),
//                     with Green's law as the shallow limit, which is the
//                     wave growing as it does so.
//   `buildTable` /    both of those and coth(k·d) precomputed over depth per
//   `tableAt`         component, because `surfaceAt` asks tens of thousands
//                     of times a frame and cannot solve a dispersion
//                     relation on each.
//   `buildPhaseField` the eikonal |∇φ| = k(d) over the level, solved once at
//                     build time, which is what turns the crests toward the
//                     shallows and wraps them into a river mouth.
//
// Split out of `water.ts` for the §20.5 cap, and along the seam that was
// already there: nothing in here knows about a spectrum, a band or a share,
// and nothing in `water.ts` sweeps a grid.
//
// Deterministic and stateless: functions of a bed and a frequency, with no
// clock and no randomness.

import { createHeightfield, type Heightfield } from "../lib/heightfield.ts";
import { clamp } from "../lib/math.ts";
import { TUNING } from "./defs/tuning.ts";

const S = TUNING.sea;
const G = TUNING.g;

/** Local wavenumber for frequency `omega` in depth `d`, rad/m: Fenton &
 * McKee (1990)'s explicit fit to ω² = g·k·tanh(k·d), within 1.7% of the
 * exact root everywhere and exact in both limits. */
export function wavenumber(omega: number, d: number): number {
  const k0 = (omega * omega) / G;
  const depth = Math.max(d, S.minDepth);
  const t = Math.tanh(Math.pow(k0 * depth, 0.75));
  return k0 / Math.pow(t, 2 / 3);
}

/** Linear shoaling coefficient Ks = √(cg₀/cg) for wavenumber `k` at depth
 * `d`: the amplitude grows as the group velocity slows over a rising bed
 * (energy flux conserved; Dean & Dalrymple 1991 §5). */
export function shoaling(omega: number, k: number, d: number): number {
  const kd = k * Math.max(d, S.minDepth);
  const n = 0.5 * (1 + (2 * kd) / Math.sinh(2 * kd));
  const cg = (n * omega) / k;
  const cg0 = G / (2 * omega);
  return Math.sqrt(cg0 / cg);
}

export function buildTable(omega: number): Float32Array {
  const rows = Math.floor(Math.sqrt(S.tableDepth) / S.tableRoot) + 1;
  const table = new Float32Array(rows * 3);
  for (let i = 0; i < rows; i++) {
    // The axis is √d (see `tableRoot`): fine where the coefficients move
    // and coarse out on the abyssal plain where they are flat.
    const r = i * S.tableRoot;
    const d = Math.max(r * r, S.minDepth);
    const k = wavenumber(omega, d);
    table[i * 3] = k;
    table[i * 3 + 1] = shoaling(omega, k, d);
    table[i * 3 + 2] = 1 / Math.tanh(k * d);
  }
  return table;
}

/** Read a component's depth table at `d`, linearly between rows. The axis
 * is √d, so the row a depth falls on is its root over the pitch. */
export function tableAt(table: Float32Array, d: number, out: Float64Array): void {
  const rows = table.length / 3;
  const f = clamp(Math.sqrt(Math.max(d, 0)) / S.tableRoot, 0, rows - 1);
  const i0 = Math.floor(f);
  const i1 = Math.min(i0 + 1, rows - 1);
  const t = f - i0;
  for (let j = 0; j < 3; j++) {
    const a = table[i0 * 3 + j];
    out[j] = a + (table[i1 * 3 + j] - a) * t;
  }
}

/** How many times the four sweep orders are run. Two rounds settle every
 * exposed cell of a generated level to a thousandth of a radian of what
 * eight give; what is still moving after that is deep in a lee, where no
 * sea stands. */
const PHASE_ROUNDS = 2;

/** The spatial phase of one component over the level: the EIKONAL
 * |∇φ| = k(d), solved over the grid by fast sweeping (Zhao 2005) —
 * Godunov's upwind update at every cell, in each of the four sweep
 * orders, `PHASE_ROUNDS` times. The deep-water plane wave k₀·(d̂·x) flows
 * in over the rims the component travels in across; land is impassable
 * and takes no part. What comes out is the FIRST-ARRIVAL phase, which is what a
 * wave field does with a bed and a coast: it shortens with the depth,
 * turns toward the shallows (refraction), and wraps round a headland and
 * in through a river mouth as arcs about the corner — diffraction's
 * kinematics; how MUCH gets in is the exposure's question (`fetch.ts`).
 * Where two arrivals meet in a lee the field creases, as two crossing
 * trains do.
 *
 * Integrating k·ds along a fixed heading instead carries every shoal's
 * delay forever downwind of it as an offset between neighbouring paths,
 * and the lateral gradient of that offset is a wavenumber the wave never
 * had: a swell three times too short, crawling sideways, in the lee of
 * every reef and either side of every river mouth. */
export function buildPhaseField(
  ground: Heightfield,
  table: Float32Array,
  k0: number,
  dirX: number,
  dirZ: number,
): Heightfield {
  const field = createHeightfield(
    ground.originX,
    ground.originZ,
    ground.cell,
    ground.cols,
    ground.rows,
  );
  const { cols, rows, cell, data } = field;
  const n = cols * rows;
  // What a cell adds to the phase, k(d)·cell — or −1 on land.
  const stepAt = new Float32Array(n);
  const row = new Float64Array(3);
  for (let i = 0; i < n; i++) {
    const depth = -ground.data[i];
    if (depth <= 0) {
      stepAt[i] = -1;
      continue;
    }
    tableAt(table, depth, row);
    stepAt[i] = row[0] * cell;
  }
  // The deep-water plane wave at cell (c, r) — the grid's cells and the
  // ring just outside it alike.
  const plane = (c: number, r: number): number =>
    k0 * (dirX * (field.originX + c * cell) + dirZ * (field.originZ + r * cell));
  // The phase just past each rim: the plane wave on the sides the wave
  // comes IN over, nothing on the sides it leaves by — a rim it is
  // leaving must not hand it an undelayed phase back. The rim is where
  // the deep water is (R3's bed keeps falling to seaward), so the plane
  // wave is the wave there; a rim stood in water a component can feel the
  // bottom of refracts it at the rim itself, which is what the synthetic
  // level's deep variant is for.
  const west = new Float64Array(rows);
  const east = new Float64Array(rows);
  const south = new Float64Array(cols);
  const north = new Float64Array(cols);
  for (let r = 0; r < rows; r++) {
    west[r] = dirX > 0 ? plane(-1, r) : Infinity;
    east[r] = dirX < 0 ? plane(cols, r) : Infinity;
  }
  for (let c = 0; c < cols; c++) {
    south[c] = dirZ > 0 ? plane(c, -1) : Infinity;
    north[c] = dirZ < 0 ? plane(c, rows) : Infinity;
  }
  data.fill(Infinity);
  // The component's own quadrant first: one sweep settles every cell a
  // wave reaches without turning through more than a right angle, and the
  // other three orders pick up what bends further round.
  const sxs = dirX >= 0 ? [1, -1, 1, -1] : [-1, 1, -1, 1];
  const szs = dirZ >= 0 ? [1, 1, -1, -1] : [-1, -1, 1, 1];
  for (let round = 0; round < PHASE_ROUNDS; round++) {
    for (let s = 0; s < 4; s++) {
      const sx = sxs[s];
      const sz = szs[s];
      for (let i = 0; i < rows; i++) {
        const r = sz > 0 ? i : rows - 1 - i;
        const base = r * cols;
        for (let j = 0; j < cols; j++) {
          const c = sx > 0 ? j : cols - 1 - j;
          const at = base + c;
          const step = stepAt[at];
          if (step < 0) continue;
          const w = c > 0 ? data[at - 1] : west[r];
          const e = c < cols - 1 ? data[at + 1] : east[r];
          const so = r > 0 ? data[at - cols] : south[c];
          const no = r < rows - 1 ? data[at + cols] : north[c];
          const a = w < e ? w : e;
          const b = so < no ? so : no;
          const lo = a < b ? a : b;
          if (lo === Infinity) continue;
          // Godunov: the two-sided solution when both neighbours are close
          // enough to share the front, the one-sided step when they are not.
          const diff = a > b ? a - b : b - a;
          const phi =
            diff >= step ? lo + step : 0.5 * (a + b + Math.sqrt(2 * step * step - diff * diff));
          if (phi < data[at]) data[at] = phi;
        }
      }
    }
  }
  // What the sweep never reached — the land, and any water no path from
  // the sea gets to — carries the finished water beside it on, at that
  // water's own rate along the heading, two cells out: a sample in the
  // last metres before a beach is bilinear, and mixes the water's cell
  // with the land's, so it has to find a wave there and not a cliff. Past
  // that, the deep-water plane wave; nothing rides it.
  const stepOf = (at: number): number => (stepAt[at] >= 0 ? stepAt[at] : k0 * cell);
  for (let pass = 0; pass < 2; pass++) {
    const before = data.slice();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const at = r * cols + c;
        if (before[at] !== Infinity) continue;
        let sum = 0;
        let count = 0;
        if (c > 0 && before[at - 1] !== Infinity) {
          sum += before[at - 1] + stepOf(at - 1) * dirX;
          count++;
        }
        if (c < cols - 1 && before[at + 1] !== Infinity) {
          sum += before[at + 1] - stepOf(at + 1) * dirX;
          count++;
        }
        if (r > 0 && before[at - cols] !== Infinity) {
          sum += before[at - cols] + stepOf(at - cols) * dirZ;
          count++;
        }
        if (r < rows - 1 && before[at + cols] !== Infinity) {
          sum += before[at + cols] - stepOf(at + cols) * dirZ;
          count++;
        }
        if (count > 0) data[at] = sum / count;
      }
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const at = r * cols + c;
      if (data[at] === Infinity) data[at] = plane(c, r);
    }
  }
  return field;
}
