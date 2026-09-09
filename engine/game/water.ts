// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SEA — the wave field, as pure functions of (x, z, t). Nothing here
// advances: a `SeaState` is built ONCE per level from the wind and the seed,
// and `surfaceAt` reads the surface at any point at any time. The craft's
// probes read it at 120 Hz and the renderer displaces its mesh with the
// same call, so what is drawn is what is simulated.
//
// The model, and where each piece comes from:
//
// - The field is a sum of `TUNING.sea.components` sinusoidal components —
//   Gerstner/trochoidal waves (Tessendorf 2001; Finch, GPU Gems 1 ch. 1)
//   with the horizontal displacement dropped, so that the height is a
//   function of the undisplaced (x, z) the physics asks about. The crests
//   lose their trochoidal sharpening; the heights, the slopes and the
//   orbital velocities are linear theory's, which is what the rest of the
//   model (shoaling, dispersion, breaking) is stated in anyway.
// - Heights come from a fetch-limited JONSWAP spectrum (Hasselmann et al.
//   1973) capped at the fully developed Pierson–Moskowitz sea (1964): the
//   significant height and peak period follow the SPM (1984) fetch laws
//   g·Hs/U² = 1.6e-3·(g·F/U²)^½ and g·Tp/U = 0.286·(g·F/U²)^⅓, and the
//   component amplitudes are laid over the JONSWAP shape (γ = 3.3) and
//   normalised so that 4·√m0 = Hs.
// - FETCH is the level's `offshore` distance, stretched by
//   `TUNING.sea.fetchScale` (see there): the amplitudes at a point scale
//   with Hs(F(offshore))/Hs(F_ref), so the chop builds riding out to sea.
// - Each component keeps ONE frequency and direction and lets its
//   wavenumber follow the depth through the dispersion relation
//   ω² = g·k·tanh(k·d) (Airy; Fenton & McKee 1990's explicit solution),
//   integrated into a PHASE FIELD over the level's grid at build time so the
//   wavelength shortens honestly toward the shore.
// - Amplitude shoals by the linear-theory coefficient Ks = √(cg₀/cg)
//   (Green's law √√(d₀/d) is its shallow limit) and the summed height is
//   clipped at McCowan's breaking limit H = 0.78·d.
//
// Deterministic: the seed fixes the phases and the directional draws, and
// t is the only clock.

import { createHeightfield, sampleField, type Heightfield } from "../lib/heightfield.ts";
import { clamp, TAU } from "../lib/math.ts";
import { createRng } from "../lib/prng.ts";
import type { Level, Wind } from "../mapgen/types.ts";
import { TUNING } from "./defs/tuning.ts";

const S = TUNING.sea;
const G = TUNING.g;

export type WaveComponent = {
  /** Angular frequency, rad/s, and the deep-water wavenumber, rad/m. */
  readonly omega: number;
  readonly k0: number;
  /** Unit direction of travel in the plan. */
  readonly dirX: number;
  readonly dirZ: number;
  /** Deep-water amplitude at the reference fetch, m. */
  readonly amp: number;
  /** Seeded phase offset, rad. */
  readonly phase0: number;
  /** ∫k·ds over the level along the direction of travel, rad — the spatial
   * phase with the shallows' shortening already in it. */
  readonly phaseField: Heightfield;
  /** Per depth row (`TUNING.sea.tableStep` apart): local wavenumber k
   * (rad/m), shoaling coefficient Ks, and coth(k·d) for the orbital
   * velocity — three floats a row. */
  readonly table: Float32Array;
};

export type SeaState = {
  /** The wind the field was built from. */
  readonly windSpeed: number;
  readonly windFrom: number;
  /** Effective fetch the amplitudes are quoted at, m, and the significant
   * height, m, and peak period, s, there. */
  readonly fetchRef: number;
  readonly hsRef: number;
  readonly tp: number;
  readonly components: readonly WaveComponent[];
};

/** What `surfaceAt` fills: the surface height, its unit normal, and the
 * water's orbital velocity at the surface, all world frame, SI. */
export type SurfaceSample = {
  height: number;
  nx: number;
  ny: number;
  nz: number;
  vx: number;
  vy: number;
  vz: number;
};

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
  const developed = (TAU * u) / (0.877 * G);
  return Math.max(0.6, Math.min(limited, developed));
}

/** The fetch the model reads at an offshore distance, m — the level's
 * metre stretched into the tens of kilometres the growth laws work in. */
export function effectiveFetch(offshore: number): number {
  return S.baseFetch + S.fetchScale * Math.max(offshore, 0);
}

/** JONSWAP spectral density S(ω), unnormalised (α dropped: the amplitudes
 * are scaled to Hs afterwards), for peak frequency `wp`. Hasselmann et
 * al. 1973: ω⁻⁵·exp(−1.25·(ω_p/ω)⁴)·γ^r, γ = 3.3, σ = 0.07 below the peak
 * and 0.09 above it. */
function jonswap(w: number, wp: number): number {
  const sigma = w <= wp ? 0.07 : 0.09;
  const r = Math.exp(-((w - wp) * (w - wp)) / (2 * sigma * sigma * wp * wp));
  return Math.pow(w, -5) * Math.exp(-1.25 * Math.pow(wp / w, 4)) * Math.pow(3.3, r);
}

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

function buildTable(omega: number): Float32Array {
  const rows = Math.floor(S.tableDepth / S.tableStep) + 1;
  const table = new Float32Array(rows * 3);
  for (let i = 0; i < rows; i++) {
    const d = Math.max(i * S.tableStep, S.minDepth);
    const k = wavenumber(omega, d);
    table[i * 3] = k;
    table[i * 3 + 1] = shoaling(omega, k, d);
    table[i * 3 + 2] = 1 / Math.tanh(k * d);
  }
  return table;
}

/** Read a component's depth table at `d`, linearly between rows. */
function tableAt(table: Float32Array, d: number, out: Float64Array): void {
  const rows = table.length / 3;
  const f = clamp(d / S.tableStep, 0, rows - 1);
  const i0 = Math.floor(f);
  const i1 = Math.min(i0 + 1, rows - 1);
  const t = f - i0;
  for (let j = 0; j < 3; j++) {
    const a = table[i0 * 3 + j];
    out[j] = a + (table[i1 * 3 + j] - a) * t;
  }
}

/** The spatial phase of one component over the level: an upwind sweep in
 * the direction of travel, each cell one step of `k(d)·ds` past its two
 * upwind neighbours. Reproduces the deep-water plane wave k₀·(d̂·x) exactly
 * where the depth is uniform and bends the wavelength with the bed where
 * it is not; refraction (the direction turning toward the shore) is left
 * out, since every component keeps its heading. Cells upwind of the grid
 * read the plane wave, which is where the deep water is. */
function buildPhaseField(
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
  const { cols, rows, cell } = field;
  const ax = Math.abs(dirX);
  const az = Math.abs(dirZ);
  const sx = dirX >= 0 ? 1 : -1;
  const sz = dirZ >= 0 ? 1 : -1;
  const step = cell / (ax + az);
  const row = new Float64Array(3);
  const plane = (c: number, r: number): number =>
    k0 * (dirX * (field.originX + c * cell) + dirZ * (field.originZ + r * cell));
  for (let i = 0; i < rows; i++) {
    const r = sz > 0 ? i : rows - 1 - i;
    for (let j = 0; j < cols; j++) {
      const c = sx > 0 ? j : cols - 1 - j;
      const cu = c - sx;
      const ru = r - sz;
      const fromCol = cu >= 0 && cu < cols ? field.data[r * cols + cu] : plane(cu, r);
      const fromRow = ru >= 0 && ru < rows ? field.data[ru * cols + c] : plane(c, ru);
      const depth = -ground.data[r * cols + c];
      tableAt(table, depth, row);
      field.data[r * cols + c] = (ax * fromCol + az * fromRow) / (ax + az) + row[0] * step;
    }
  }
  return field;
}

/** The furthest any point of the level is from the shore, m — where the
 * amplitudes are quoted. */
function maxOffshore(level: Level): number {
  let max = 0;
  const d = level.offshore.data;
  for (let i = 0; i < d.length; i++) if (d[i] > max) max = d[i];
  return max;
}

/** Build the field for a level's wind (or another one) and seed. */
export function createSea(level: Level, seed: number, wind: Wind = level.wind): SeaState {
  const rng = createRng((seed ^ 0x5ea5ea) >>> 0);
  const u = wind.speed;
  const fetchRef = effectiveFetch(maxOffshore(level));
  const hsRef = fetchHeight(u, fetchRef);
  const tp = fetchPeriod(u, fetchRef);
  const wp = TAU / tp;
  // Waves travel WITH the wind: `from` is where it blows from.
  const travel = wind.from + Math.PI;
  const n = S.components;
  const raw: { omega: number; dir: number; weight: number }[] = [];
  let energy = 0;
  for (let i = 0; i < n; i++) {
    // Log-spaced over the band, each component owning the band between the
    // midpoints to its neighbours.
    const lo = S.bandLow * Math.pow(S.bandHigh / S.bandLow, i / n);
    const hi = S.bandLow * Math.pow(S.bandHigh / S.bandLow, (i + 1) / n);
    const omega = wp * Math.sqrt(lo * hi);
    const dOmega = wp * (hi - lo);
    // A cos² directional spread (Longuet-Higgins et al. 1963), drawn by
    // inverse transform so the components lean toward the wind.
    const uDir = rng.next();
    const spread = S.spread * (2 * uDir - 1);
    const weight = jonswap(omega, wp) * dOmega * Math.cos((spread / S.spread) * (Math.PI / 2)) ** 2;
    energy += weight;
    raw.push({ omega, dir: travel + spread, weight });
  }
  // m0 = Σ a²/2 = (Hs/4)².
  const m0 = (hsRef / 4) ** 2;
  const components: WaveComponent[] = raw.map((c) => {
    const amp = hsRef > 0 ? Math.sqrt((2 * m0 * c.weight) / energy) : 0;
    const k0 = (c.omega * c.omega) / G;
    const dirX = Math.sin(c.dir);
    const dirZ = Math.cos(c.dir);
    const table = buildTable(c.omega);
    return {
      omega: c.omega,
      k0,
      dirX,
      dirZ,
      amp,
      phase0: rng.next() * TAU,
      phaseField: buildPhaseField(level.ground, table, k0, dirX, dirZ),
      table,
    };
  });
  return { windSpeed: u, windFrom: wind.from, fetchRef, hsRef, tp, components };
}

/** How much of the reference amplitude reaches a point `offshore` metres
 * out, 0..1: the fetch law's growth, so the chop builds to seaward. */
export function fetchGrowth(sea: SeaState, offshore: number): number {
  if (sea.hsRef <= 0) return 0;
  return fetchHeight(sea.windSpeed, effectiveFetch(offshore)) / sea.hsRef;
}

/** The sea's headline numbers at an offshore distance: significant height
 * (m, by the fetch law at that distance) and the peak period (s, the
 * field's own — one period per component for the whole level). */
export function seaSummary(sea: SeaState, offshore: number): { Hs: number; Tp: number } {
  return { Hs: fetchHeight(sea.windSpeed, effectiveFetch(offshore)), Tp: sea.tp };
}

const scratch = new Float64Array(3);

/** The surface at a plan point and time. Writes into `out` when given so
 * a mesh of forty thousand vertices allocates nothing per frame. */
export function surfaceAt(
  sea: SeaState,
  level: Level,
  x: number,
  z: number,
  t: number,
  out: SurfaceSample = { height: 0, nx: 0, ny: 1, nz: 0, vx: 0, vy: 0, vz: 0 },
): SurfaceSample {
  const depth = Math.max(-sampleField(level.ground, x, z), S.minDepth);
  const growth = fetchGrowth(sea, sampleField(level.offshore, x, z));
  // First pass: the shoaled amplitudes and the breaking cap they sum to.
  // McCowan's limit is on the wave HEIGHT (crest to trough), which for a
  // sum of sinusoids is at most twice the summed amplitude.
  const comps = sea.components;
  let sumAmp = 0;
  let height = 0;
  let sx = 0;
  let sz = 0;
  let vx = 0;
  let vy = 0;
  let vz = 0;
  const cap = (S.breakingRatio * depth) / 2;
  // The amplitude scale is common to every component, so it can be
  // computed before the sum from the shoaling coefficients alone.
  for (let i = 0; i < comps.length; i++) {
    tableAt(comps[i].table, depth, scratch);
    sumAmp += comps[i].amp * scratch[1];
  }
  sumAmp *= growth;
  const clip = sumAmp > cap ? cap / sumAmp : 1;
  for (let i = 0; i < comps.length; i++) {
    const c = comps[i];
    tableAt(c.table, depth, scratch);
    const k = scratch[0];
    const a = c.amp * scratch[1] * growth * clip;
    if (a <= 0) continue;
    const phase = sampleField(c.phaseField, x, z) - c.omega * t + c.phase0;
    const sin = Math.sin(phase);
    const cos = Math.cos(phase);
    height += a * sin;
    // Slope from the phase gradient k·d̂ (the amplitude's own gradient is
    // a shoaling effect too slow to tilt the surface).
    sx += a * k * c.dirX * cos;
    sz += a * k * c.dirZ * cos;
    // Orbital velocity at the surface (Airy): horizontal a·ω·coth(kd) in
    // phase with the height, vertical −a·ω·cos φ (the surface's own rate).
    const horizontal = a * c.omega * scratch[2] * sin;
    vx += horizontal * c.dirX;
    vz += horizontal * c.dirZ;
    vy -= a * c.omega * cos;
  }
  const nl = Math.hypot(sx, 1, sz);
  out.height = height;
  out.nx = -sx / nl;
  out.ny = 1 / nl;
  out.nz = -sz / nl;
  out.vx = vx;
  out.vy = vy;
  out.vz = vz;
  return out;
}

/** The surface height alone, for callers that want nothing else. */
export function heightAt(sea: SeaState, level: Level, x: number, z: number, t: number): number {
  return surfaceAt(sea, level, x, z, t, scratchSample).height;
}

const scratchSample: SurfaceSample = { height: 0, nx: 0, ny: 1, nz: 0, vx: 0, vy: 0, vz: 0 };
