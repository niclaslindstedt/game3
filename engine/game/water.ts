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
//   in `fetch.ts`, and the component amplitudes are laid over the JONSWAP
//   shape (γ is `TUNING.sea.peakEnhancement`) and normalised so that
//   4·√m0 = Hs.
// - THERE ARE TWO BANDS, because there are two kinds of water in a level
//   and they do not carry the same waves.
//
//     THE OCEAN BAND is the sea the wind has grown over the whole fetch
//     of the coast this level is a piece of — the long, ordered thing a
//     rider races in. It is quoted at the course's own effective fetch,
//     and at a point it is scaled by that point's EXPOSURE: how much of
//     the open sea is upwind of it (`fetch.ts`). With an onshore wind
//     (R12) that is all of it at sea and all of it a few metres off the
//     beach — so the waves come INTO the shore — and none of it a hundred
//     metres up a river, which land has closed round.
//
//     THE LOCAL BAND is the wind chop that grows on water the ocean's own
//     sea never reaches: short, small, and entirely the local wind's doing
//     over the few metres of water it crossed. It fills in exactly where
//     the ocean band does not (its share is `(1 − exposure) · chop`), so
//     the two never double-count, and it is what a river actually has —
//     a ripple a couple of metres long, not a swell that came up it.
//
//   The local band carries no phase field: a five-metre wave feels the
//   bottom only in water a hull is already aground in, so it is a plane
//   wave, which is a sample per component saved in the hottest loop here.
// - The wind sea's HEIGHT and PERIOD take `TUNING.sea.heightScale` and
//   `periodScale` — the two arcade dials that say how big and how long a
//   wind sea is here, against what the law alone would grow. The shares
//   are ratios, so neither disturbs the shape.
// - THE WATER ITSELF MOVES. The orbital velocity a component carries is
//   the wave's; a river's is not (R27), and `surfaceAt` adds the level's
//   baked current to what it reports. Everything that asks the water how
//   fast it is going — the hull's drag, the spray, the wake — therefore
//   feels the river drift the craft without knowing there is a river.
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
import { createRng, type Rng } from "../lib/prng.ts";
import { flowAt } from "../mapgen/flow.ts";
import type { Level, Wind } from "../mapgen/types.ts";
import { TUNING } from "./defs/tuning.ts";
import { createShelter, effectiveFetch, fetchHeight, fetchPeriod, type Shelter } from "./fetch.ts";

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
   * phase with the shallows' shortening already in it. Null for the LOCAL
   * band, whose waves are too short to feel any bed a hull can float over:
   * those read the deep-water plane wave k₀·(d̂·x) instead. */
  readonly phaseField: Heightfield | null;
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
  /** What the level looks like to that wind: the exposure and chop shares
   * `surfaceAt` reads, and the shelter the wind model reads (`fetch.ts`). */
  readonly shelter: Shelter;
  /** Effective fetch the OCEAN band is quoted at, m — the course's own —
   * and the significant height, m, and peak period, s, there. */
  readonly fetchRef: number;
  readonly hsRef: number;
  readonly tp: number;
  /** ...and the LOCAL band's, quoted at `sea.localFetch` under the level's
   * mean wind. `chop` is a share of `localHs`. */
  readonly localHs: number;
  readonly localTp: number;
  /** The OCEAN band first, longest component first, then the local band —
   * an order `surfaceAt`'s `count` depends on, since a caller asking for
   * the first few components is asking for the swell. */
  readonly components: readonly WaveComponent[];
  readonly oceanCount: number;
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

/** The peak period, s, a sea of significant height `hs` (m) is given when
 * it is quoted without one: the significant steepness Hs/L₀ is
 * `TUNING.sea.steepness` and L₀ = g·Tp²/2π (Airy) turns that round. The
 * steepness is what makes a quoted sea a WALL rather than a long swell —
 * see the dial. What a `SeaOverride` without a period is given. */
export function periodForHeight(hs: number): number {
  return Math.max(0.6, Math.sqrt((TAU * Math.max(hs, 0)) / (G * S.steepness)));
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

/** Lay one band of components over a JONSWAP spectrum: `n` of them,
 * log-spaced over `[low, high]` multiples of the peak, travelling `travel`
 * with a cos² directional spread about it (Longuet-Higgins et al. 1963,
 * drawn by inverse transform so they lean toward the wind), and scaled so
 * that 4·√m0 = `hs`.
 *
 * `ground` is the bed the phase field is integrated over, or null for a
 * band short enough to be a plane wave everywhere a hull can float.
 */
function layBand(
  rng: Rng,
  hs: number,
  tp: number,
  n: number,
  low: number,
  high: number,
  travel: number,
  ground: Heightfield | null,
): WaveComponent[] {
  const wp = TAU / tp;
  const raw: { omega: number; dir: number; weight: number }[] = [];
  let energy = 0;
  for (let i = 0; i < n; i++) {
    // Log-spaced over the band, each component owning the band between the
    // midpoints to its neighbours.
    const lo = low * Math.pow(high / low, i / n);
    const hi = low * Math.pow(high / low, (i + 1) / n);
    const omega = wp * Math.sqrt(lo * hi);
    const dOmega = wp * (hi - lo);
    const spread = S.spread * (2 * rng.next() - 1);
    const weight = jonswap(omega, wp) * dOmega * Math.cos((spread / S.spread) * (Math.PI / 2)) ** 2;
    energy += weight;
    raw.push({ omega, dir: travel + spread, weight });
  }
  // m0 = Σ a²/2 = (Hs/4)².
  const m0 = (hs / 4) ** 2;
  return raw.map((c) => {
    const amp = hs > 0 && energy > 0 ? Math.sqrt((2 * m0 * c.weight) / energy) : 0;
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
      phaseField: ground ? buildPhaseField(ground, table, k0, dirX, dirZ) : null,
      table,
    };
  });
}

/** Build the field for a level's wind (or another one) and seed, or for a
 * sea quoted outright (`override`). `shelter` is what the level looks like
 * to that wind (`fetch.ts`); it is measured here when it is not handed in,
 * and `createGame` hands in the one the wind model is using so a run
 * measures the coast once. */
export function createSea(
  level: Level,
  seed: number,
  wind: Wind = level.wind,
  override?: SeaOverride,
  shelter: Shelter = createShelter(level, wind),
): SeaState {
  const rng = createRng((seed ^ 0x5ea5ea) >>> 0);
  const u = wind.speed;
  // Waves travel WITH the wind: `from` is where it blows from.
  const travel = wind.from + Math.PI;

  // ── The ocean band ────────────────────────────────────────────────────
  const fetchRef = effectiveFetch(shelter.reachRef);
  const hsRef = override ? Math.max(0, override.hs) : fetchHeight(u, fetchRef) * S.heightScale;
  // A quoted sea takes its period from `steepness`; a wind sea takes the
  // law's and scales it. Either way this is the WAVELENGTH dial, since
  // L₀ = g·Tp²/2π.
  const tp = override
    ? (override.tp ?? periodForHeight(hsRef))
    : fetchPeriod(u, fetchRef) * S.periodScale;
  // The band's short end: `bandHigh` peaks, or the absolute shortest
  // period the field carries, whichever reaches further. A slow-peaked
  // swell needs the second or it arrives with no chop on it.
  const bandHigh = Math.max(S.bandHigh, tp / S.minPeriod);
  const ocean = layBand(rng, hsRef, tp, S.components, S.bandLow, bandHigh, travel, level.ground);

  // ── The local band ────────────────────────────────────────────────────
  // Quoted once for the level, at the MEAN wind over `localFetch` — the
  // same reference `shelter.chop` is a share of, so the two cannot drift.
  const localHs = fetchHeight(u, S.localFetch) * S.heightScale;
  const localTp = fetchPeriod(u, S.localFetch) * S.periodScale;
  const local = layBand(
    rng,
    localHs,
    localTp,
    S.localComponents,
    S.localBandLow,
    S.localBandHigh,
    travel,
    null,
  );

  return {
    windSpeed: u,
    windFrom: wind.from,
    shelter,
    fetchRef,
    hsRef,
    tp,
    localHs,
    localTp,
    components: [...ocean, ...local],
    oceanCount: ocean.length,
  };
}

/** What share of each band stands at a plan point: the OCEAN band's is
 * the point's exposure to the open sea, and the LOCAL band's is what is
 * left over, times the chop the sheltered wind grows on the point's own
 * water. They partition rather than add, so no water is dealt two seas. */
export function seaShares(sea: SeaState, x: number, z: number): { ocean: number; local: number } {
  const ocean = clamp(sampleField(sea.shelter.exposure, x, z), 0, 1);
  return { ocean, local: (1 - ocean) * Math.max(0, sampleField(sea.shelter.chop, x, z)) };
}

/** The sea's headline numbers at a plan point: significant height (m — the
 * two bands summed in energy, before the bed clips them) and the peak
 * period (s) of whichever band is carrying it there. Which is why a river
 * reads a tenth of a metre at a second and a half where the water off the
 * beach reads a metre and a half at four. */
export function seaSummary(sea: SeaState, x: number, z: number): { Hs: number; Tp: number } {
  const { ocean, local } = seaShares(sea, x, z);
  const hsOcean = sea.hsRef * ocean;
  const hsLocal = sea.localHs * local;
  return {
    Hs: Math.hypot(hsOcean, hsLocal),
    Tp: hsOcean >= hsLocal ? sea.tp : sea.localTp,
  };
}

const scratch = new Float64Array(3);
/** Three numbers a component — the local wavenumber, the amplitude it
 * actually stands at here, and coth(k·d) — kept between the two passes
 * below so the depth table is read once per component rather than twice. */
const held = new Float64Array(3 * (S.components + S.localComponents));
const drift = { x: 0, z: 0 };

/** The surface at a plan point and time. Writes into `out` when given so
 * a mesh of forty thousand vertices allocates nothing per frame. `count`
 * sums only the first that many components — the LONGEST of the OCEAN
 * band, since the field is laid from the low end of that band up — which
 * is what the renderer's far water reads: the swell a coarse far grid can
 * carry, without the chop it cannot, off the same field and the same
 * clock. */
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
  // `seaShares`, inlined: this is called thousands of times a frame by the
  // renderer's water grid and twelve times a step by the hull, and an object
  // returned per call is an allocation on every one of them.
  const ocean = clamp(sampleField(sea.shelter.exposure, x, z), 0, 1);
  const local = (1 - ocean) * Math.max(0, sampleField(sea.shelter.chop, x, z));
  // First pass: the shoaled amplitudes each band's share leaves standing
  // here, and the depth limit the SEA they make together has to stay
  // under. The limit is on the significant height — Hs = 4·√m0 over the
  // shoaled spectrum — and not on the arithmetic sum of the amplitudes,
  // which is the superposition where every component crests at once and
  // is ~1.8× the significant amplitude: clipping to that holds a sea in
  // deep water to a third of the height its own spectrum carries.
  // Individual crests ride past Hs here as they do in nature; the bed is
  // what they break on.
  //
  // Over EVERY component, whatever `count` asks to be summed: the clip is
  // the sea's own, and a far grid drawing two components of it has to be
  // clipped by what the whole sea does or the swell steps at the seam.
  //
  // A band whose share here is nothing is skipped outright rather than
  // multiplied by zero, and that is most of a level: out at sea the local
  // band is absent and up a river the ocean band is, so all but the water
  // round a river mouth pays for ONE band. The threshold is a thousandth
  // of a quoted sea — under a millimetre of water, which is nothing a
  // hull or an eye can tell from none.
  const comps = sea.components;
  const total = comps.length;
  const n = Math.min(count, total);
  let m0 = 0;
  for (let i = 0; i < total; i++) {
    const c = comps[i];
    const share = i < sea.oceanCount ? ocean : local;
    if (share <= 1e-3) {
      held[i * 3 + 1] = 0;
      continue;
    }
    tableAt(c.table, depth, scratch);
    const a = c.amp * scratch[1] * share;
    held[i * 3] = scratch[0];
    held[i * 3 + 1] = a;
    held[i * 3 + 2] = scratch[2];
    m0 += a * a;
  }
  // m0 = Σa²/2, Hs = 4√m0 = 2·√(2·Σa²).
  const hs = 2 * Math.SQRT2 * Math.sqrt(m0);
  const cap = S.breakingHs * depth;
  const clip = hs > cap ? cap / hs : 1;
  let height = 0;
  let sx = 0;
  let sz = 0;
  let vx = 0;
  let vy = 0;
  let vz = 0;
  for (let i = 0; i < n; i++) {
    const c = comps[i];
    const k = held[i * 3];
    const a = held[i * 3 + 1] * clip;
    if (a <= 0) continue;
    // The ocean band's phase is integrated over the bed so its wavelength
    // shortens honestly toward the shore; the local band's is the plane
    // wave, which is the same thing for a wave that never feels a bottom.
    const spatial = c.phaseField
      ? sampleField(c.phaseField, x, z)
      : c.k0 * (c.dirX * x + c.dirZ * z);
    const phase = spatial - c.omega * t + c.phase0;
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
    const horizontal = a * c.omega * held[i * 3 + 2] * sin;
    vx += horizontal * c.dirX;
    vz += horizontal * c.dirZ;
    vy -= a * c.omega * cos;
  }
  // R27 — and the water it is all riding on may itself be going somewhere.
  flowAt(level.flow, x, z, drift);
  const nl = Math.hypot(sx, 1, sz);
  out.height = height;
  out.nx = -sx / nl;
  out.ny = 1 / nl;
  out.nz = -sz / nl;
  out.vx = vx + drift.x;
  out.vy = vy;
  out.vz = vz + drift.z;
  return out;
}

/** The surface height alone, for callers that want nothing else. */
export function heightAt(sea: SeaState, level: Level, x: number, z: number, t: number): number {
  return surfaceAt(sea, level, x, z, t, scratchSample).height;
}

const scratchSample: SurfaceSample = { height: 0, nx: 0, ny: 1, nz: 0, vx: 0, vy: 0, vz: 0 };
