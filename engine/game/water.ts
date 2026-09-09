// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SEA — the wave field, as pure functions of (x, z, t). Nothing here
// advances: a `SeaState` is built ONCE per level from the wind and the seed,
// and `surfaceAt` reads the surface at any point at any time. The craft's
// probes read it at 120 Hz and the renderer displaces its mesh with the
// same call, so what is drawn is what is simulated.
//
// The model, and where each piece comes from:
//
// - The field is a sum of `TUNING.sea.components` components, each a
//   linear (Airy) wave carrying STOKES' second-order correction (1847):
//   η = a·sin φ − ½·k·a²·cos 2φ. The trochoidal shape — a peaked crest
//   over a long flat trough — is what that second term is, and taking it
//   this way rather than as the Gerstner horizontal displacement
//   (Tessendorf 2001; Finch, GPU Gems 1 ch. 1) keeps the height a
//   function of the UNDISPLACED (x, z) the physics asks about: a Gerstner
//   field would have to be inverted at every probe and every vertex.
//   Heights, slopes and orbital velocities are otherwise linear theory's,
//   which is what the rest of the model (shoaling, dispersion, breaking)
//   is stated in anyway.
// - Heights come from a fetch-limited JONSWAP spectrum (Hasselmann et al.
//   1973) capped at the fully developed Pierson–Moskowitz sea (1964): the
//   significant height and peak period follow the SPM (1984) fetch laws
//   g·Hs/U² = 1.6e-3·(g·F/U²)^½ and g·Tp/U = 0.286·(g·F/U²)^⅓, and the
//   component amplitudes are laid over the JONSWAP shape (γ is
//   `TUNING.sea.peakEnhancement`) and
//   normalised so that 4·√m0 = Hs.
// - FETCH is the level's `offshore` distance, stretched by
//   `TUNING.sea.fetchScale` (see there): the amplitudes at a point scale
//   with Hs(F(offshore))/Hs(F_ref), so the chop builds riding out to sea.
// - The wind sea's HEIGHT and PERIOD then take `TUNING.sea.heightScale`
//   and `periodScale` — the two arcade dials that say how big and how
//   long a wind sea is here, against what the law alone would grow. The
//   growth is a ratio, so neither disturbs its shape.
// - Each component keeps ONE frequency and direction and lets its
//   wavenumber follow the depth through the dispersion relation
//   ω² = g·k·tanh(k·d) (Airy; Fenton & McKee 1990's explicit solution),
//   integrated into a PHASE FIELD over the level's grid at build time so the
//   wavelength shortens honestly toward the shore.
// - Amplitude shoals by the linear-theory coefficient Ks = √(cg₀/cg)
//   (Green's law √√(d₀/d) is its shallow limit) and the sea is clipped
//   where the bed cannot hold it: the SIGNIFICANT height at the point is
//   held to `TUNING.sea.breakingHs`·d (Nelson 1994's depth-limited sea),
//   and every component is scaled by the same factor when it passes.
// - THERE IS NO ARCADE CEILING. The sea is bounded by the fully developed
//   law and by the depth under it, nothing else: a run handed a SEA
//   OVERRIDE (`SeaOverride` — a swell quoted by its height rather than
//   grown from the wind, the way a storm far out at sea sends one in) can
//   stand a twenty-metre sea over deep water, and every term here — the
//   depth table, the phase field, the orbital velocity — is sized to
//   carry it (`tests/waves_test.ts`'s storm case).
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

/** A sea quoted by its own numbers instead of grown from the wind: the
 * significant height, m, and — left out — the peak period a wind sea of
 * that height carries (`periodForHeight`). The fetch still shapes it: the
 * height quoted is the course's, and the sea builds to seaward from there
 * by the wind's own growth law (uniform when there is no wind). */
export type SeaOverride = {
  readonly hs: number;
  readonly tp?: number;
};

export type SeaState = {
  /** The wind the field was built from. */
  readonly windSpeed: number;
  readonly windFrom: number;
  /** Effective fetch the amplitudes are quoted at, m — the course's own
   * — and the significant height, m, and peak period, s, there. */
  readonly fetchRef: number;
  readonly hsRef: number;
  readonly tp: number;
  /** What the wind alone would grow at the reference fetch, m — the
   * denominator of the fetch growth (0 when there is no wind, and the sea
   * is then the override's, uniform). */
  readonly windHs: number;
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

/** The peak period, s, a sea of significant height `hs` (m) is given when
 * it is quoted without one: the significant steepness Hs/L₀ is
 * `TUNING.sea.steepness` and L₀ = g·Tp²/2π (Airy) turns that round. The
 * steepness is what makes a quoted sea a WALL rather than a long swell —
 * see the dial. What a `SeaOverride` without a period is given. */
export function periodForHeight(hs: number): number {
  return Math.max(0.6, Math.sqrt((TAU * Math.max(hs, 0)) / (G * S.steepness)));
}

/** The fetch the model reads at an offshore distance, m — the level's
 * metre stretched into the tens of kilometres the growth laws work in. */
export function effectiveFetch(offshore: number): number {
  return S.baseFetch + S.fetchScale * Math.max(offshore, 0);
}

/** JONSWAP spectral density S(ω), unnormalised (α dropped: the amplitudes
 * are scaled to Hs afterwards), for peak frequency `wp`. Hasselmann et
 * al. 1973: ω⁻⁵·exp(−1.25·(ω_p/ω)⁴)·γ^r, σ = 0.07 below the peak and 0.09
 * above it. γ is `TUNING.sea.peakEnhancement` — at 1 this is
 * Pierson–Moskowitz, the broad fully developed sea. */
function jonswap(w: number, wp: number): number {
  const sigma = w <= wp ? 0.07 : 0.09;
  const r = Math.exp(-((w - wp) * (w - wp)) / (2 * sigma * sigma * wp * wp));
  return Math.pow(w, -5) * Math.exp(-1.25 * Math.pow(wp / w, 4)) * Math.pow(S.peakEnhancement, r);
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

/** The offshore distance the sea is QUOTED at, m: the mean over the course's
 * gates — the water the level is ridden in — so the one peak period the
 * field carries is the period of the sea under the course, not of the
 * furthest cell of open water the bounds happen to hold (which stands
 * several hundred metres further out and would give every gate a longer,
 * gentler swell than its fetch earns). Falls back to the furthest cell
 * for a level with no gates. */
function courseOffshore(level: Level): number {
  const gates = level.course.gates;
  if (gates.length > 0) {
    let sum = 0;
    for (const g of gates) sum += Math.max(0, sampleField(level.offshore, g.x, g.z));
    return sum / gates.length;
  }
  let max = 0;
  const d = level.offshore.data;
  for (let i = 0; i < d.length; i++) if (d[i] > max) max = d[i];
  return max;
}

/** Build the field for a level's wind (or another one) and seed, or for a
 * sea quoted outright (`override`). */
export function createSea(
  level: Level,
  seed: number,
  wind: Wind = level.wind,
  override?: SeaOverride,
): SeaState {
  const rng = createRng((seed ^ 0x5ea5ea) >>> 0);
  const u = wind.speed;
  const fetchRef = effectiveFetch(courseOffshore(level));
  // What the LAW grows at the reference fetch — the denominator of the
  // fetch growth, and so unscaled: the growth is a ratio and the dials
  // cancel out of it, which is what keeps the growth SHAPE Hasselmann's
  // while the metre it is quoted in moves.
  const windHs = fetchHeight(u, fetchRef);
  const hsRef = override ? Math.max(0, override.hs) : windHs * S.heightScale;
  // A quoted sea takes its period from `steepness`; a wind sea takes the
  // law's and scales it. Either way this is the WAVELENGTH dial, since
  // L₀ = g·Tp²/2π.
  const tp = override
    ? (override.tp ?? periodForHeight(hsRef))
    : fetchPeriod(u, fetchRef) * S.periodScale;
  const wp = TAU / tp;
  // Waves travel WITH the wind: `from` is where it blows from.
  const travel = wind.from + Math.PI;
  const n = S.components;
  // The band's short end: `bandHigh` peaks, or the absolute shortest
  // period the field carries, whichever reaches further. A slow-peaked
  // swell needs the second or it arrives with no chop on it.
  const bandHigh = Math.max(S.bandHigh, tp / S.minPeriod);
  const raw: { omega: number; dir: number; weight: number }[] = [];
  let energy = 0;
  for (let i = 0; i < n; i++) {
    // Log-spaced over the band, each component owning the band between the
    // midpoints to its neighbours.
    const lo = S.bandLow * Math.pow(bandHigh / S.bandLow, i / n);
    const hi = S.bandLow * Math.pow(bandHigh / S.bandLow, (i + 1) / n);
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
  return { windSpeed: u, windFrom: wind.from, fetchRef, hsRef, tp, windHs, components };
}

/** How much of the reference amplitude reaches a point `offshore` metres
 * out: the fetch law's growth, so the chop builds to seaward — under 1
 * inshore of the course, past 1 beyond it; 1 everywhere for a quoted sea
 * with no wind to grow it. */
export function fetchGrowth(sea: SeaState, offshore: number): number {
  if (sea.hsRef <= 0) return 0;
  if (sea.windHs <= 0) return 1;
  return fetchHeight(sea.windSpeed, effectiveFetch(offshore)) / sea.windHs;
}

/** The sea's headline numbers at an offshore distance: significant height
 * (m, the quoted height grown by the fetch law to that distance) and the
 * peak period (s, the field's own — one period per component for the
 * whole level). */
export function seaSummary(sea: SeaState, offshore: number): { Hs: number; Tp: number } {
  return { Hs: sea.hsRef * fetchGrowth(sea, offshore), Tp: sea.tp };
}

const scratch = new Float64Array(3);

/** The surface at a plan point and time. Writes into `out` when given so
 * a mesh of forty thousand vertices allocates nothing per frame. `count`
 * sums only the first that many components — the LONGEST, since the
 * field is laid from the low end of the band up — which is what the
 * renderer's far water reads: the swell a coarse far grid can carry,
 * without the chop it cannot, off the same field and the same clock. */
export function surfaceAt(
  sea: SeaState,
  level: Level,
  x: number,
  z: number,
  t: number,
  out: SurfaceSample = { height: 0, nx: 0, ny: 1, nz: 0, vx: 0, vy: 0, vz: 0 },
  count: number = sea.components.length,
): SurfaceSample {
  const depth = Math.max(-sampleField(level.ground, x, z), S.minDepth);
  const growth = fetchGrowth(sea, sampleField(level.offshore, x, z));
  // First pass: the shoaled amplitudes, and the depth limit the SEA they
  // make has to stay under. The limit is on the significant height —
  // Hs = 4·√m0 over the shoaled, fetch-grown spectrum — and not on the
  // arithmetic sum of the amplitudes, which is the superposition where
  // every component crests at once and is ~1.8× the significant amplitude:
  // clipping to that holds a sea in deep water to a third of the height
  // its own spectrum carries. Individual crests ride past Hs here as they
  // do in nature; the bed is what they break on.
  const comps = sea.components;
  const n = Math.min(count, comps.length);
  let m0 = 0;
  let height = 0;
  let sx = 0;
  let sz = 0;
  let vx = 0;
  let vy = 0;
  let vz = 0;
  // The amplitude scale is common to every component, so it can be
  // computed before the sum from the shoaling coefficients alone.
  for (let i = 0; i < comps.length; i++) {
    tableAt(comps[i].table, depth, scratch);
    const a = comps[i].amp * scratch[1];
    m0 += a * a;
  }
  // m0 = Σa²/2, Hs = 4√m0 = 2·√(2·Σa²) — the growth is common to all.
  const hsLocal = 2 * Math.SQRT2 * Math.sqrt(m0) * growth;
  const cap = S.breakingHs * depth;
  const clip = hsLocal > cap ? cap / hsLocal : 1;
  for (let i = 0; i < n; i++) {
    const c = comps[i];
    tableAt(c.table, depth, scratch);
    const k = scratch[0];
    const a = c.amp * scratch[1] * growth * clip;
    if (a <= 0) continue;
    const phase = sampleField(c.phaseField, x, z) - c.omega * t + c.phase0;
    const sin = Math.sin(phase);
    const cos = Math.cos(phase);
    // STOKES SECOND ORDER (1847): a linear component is a rounded hump,
    // and a real wave is not — its crest is peaked and its trough is long
    // and flat. The correction −½·k·a²·cos 2φ is exactly that shape, and
    // it is a function of the UNDISPLACED point, so the whole field stays
    // a function of (x, z) the physics can ask about — which the Gerstner
    // horizontal displacement, the other way to the same shape, is not.
    // Evaluated at a steepness the expansion is still good at, so a steep
    // component peaks rather than growing a second bump in its trough.
    const steep = Math.min(k * a, S.crestMaxSteepness) * S.crestSharpness;
    const peak = 0.5 * steep * a;
    height += a * sin - peak * Math.cos(2 * phase);
    // Slope from the phase gradient k·d̂ (the amplitude's own gradient is
    // a shoaling effect too slow to tilt the surface), with the crest
    // correction's own slope on it: d/dφ[−½·k·a²·cos 2φ] = k·a²·sin 2φ.
    const dEta = a * cos + 2 * peak * Math.sin(2 * phase);
    sx += dEta * k * c.dirX;
    sz += dEta * k * c.dirZ;
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
