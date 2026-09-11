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
// - THERE ARE THREE BANDS, because there are three kinds of water a rider
//   can reach and they do not carry the same waves.
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
//     THE OPEN BAND is the storm out past the edge of the built level
//     (`ocean.ts`). Seaward of the grid there is no coast left to shelter
//     anything and no fetch left to grow a sea over, so this one is QUOTED
//     rather than grown — `TUNING.sea.open.hs`, at the period
//     `periodForHeight` gives it — and its share rises with the storm's
//     ramp while the OCEAN band's falls away, so the sea a rider is in
//     grows steadily from the coast's own to twenty metres the further out
//     he holds the throttle open. Inside the level its share is exactly
//     zero and it costs one comparison per sample.
//
//   Neither the local nor the open band carries a phase field. A five-metre
//   wave feels the bottom only in water a hull is already aground in, and
//   the open ocean has no bed worth refracting over, so both are plane
//   waves — a field sample per component saved in the hottest loop here.
//   The OCEAN band's field is carried past the rim analytically instead
//   (`surfaceAt`), because a clamped field gradient is a sea that heaves in
//   one place without travelling.
// - The wind sea's HEIGHT and PERIOD take `TUNING.sea.heightScale` and
//   `periodScale` — the two arcade dials that say how big and how long a
//   wind sea is here, against what the law alone would grow. The shares
//   are ratios, so neither disturbs the shape.
// - THE WATER ITSELF MOVES. The orbital velocity a component carries is
//   the wave's; a river's is not (R27), and `surfaceAt` adds the level's
//   baked current to what it reports. Everything that asks the water how
//   fast it is going — the hull's drag, the spray, the wake — therefore
//   feels the river drift the craft without knowing there is a river.
// - Each component keeps ONE frequency and lets its wavenumber follow
//   the depth through the dispersion relation ω² = g·k·tanh(k·d) (Airy;
//   Fenton & McKee 1990's explicit solution). Its PHASE over the level is
//   the eikonal |∇φ| = k(d), solved over the grid at build time: the
//   wavelength shortens toward the shore, the crests turn with the bed
//   (refraction) and bend in round a headland and through a river mouth
//   (diffraction's kinematics), and the local wave vector — what the
//   slope and the orbital motion follow — is that field's gradient.
// - THE BED GOES ON PAST THE GRID. The depth every term here reads is
//   `oceanDepth` (`ocean.ts`): the level's own bed inside the grid, falling
//   on to the open ocean's floor outside it, because the sampler's clamped
//   rim would hold a twenty-metre sea to what thirty metres of water can
//   carry.
// - Amplitude shoals by the linear-theory coefficient Ks = √(cg₀/cg)
//   (Green's law √√(d₀/d) is its shallow limit) and the sea is clipped
//   where the bed cannot hold it: the SIGNIFICANT height at the point is
//   held to `TUNING.sea.breakingHs`·d (Nelson 1994's depth-limited sea),
//   and every component is scaled by the same factor when it passes.
// - THERE IS NO ARCADE CEILING ON THE SEA'S HEIGHT. It is bounded by the
//   fully developed law and by the depth under it, nothing else: a run
//   handed a SEA OVERRIDE (`SeaOverride` — a swell quoted by its height
//   rather than grown from the wind) can stand a twenty-metre sea over deep
//   water, and so can a rider who simply rides out to the open band's
//   storm. Every term here — the depth table, the phase field, the orbital
//   velocity — is sized to carry it (`tests/waves_test.ts`'s storm case).
//
// Deterministic: the seed fixes the phases and the directional draws, and
// t is the only clock.

import {
  createHeightfield,
  sampleField,
  sampleFieldGradient,
  type Heightfield,
} from "../lib/heightfield.ts";
import { clamp, TAU } from "../lib/math.ts";
import { createRng, type Rng } from "../lib/prng.ts";
import { flowAt } from "../mapgen/flow.ts";
import type { Bounds, Level, Wind } from "../mapgen/types.ts";
import { TUNING } from "./defs/tuning.ts";
import { createShelter, effectiveFetch, fetchHeight, fetchPeriod, type Shelter } from "./fetch.ts";
import { oceanDepth, oceanOffset, stormAt, stormRamp } from "./ocean.ts";

const S = TUNING.sea;
const G = TUNING.g;

/** WHICH SEA a component belongs to, and so which share it stands at —
 * the three in the header: the coast's own ocean swell, the chop on water
 * that swell cannot reach, and the storm past the edge of the level. */
export type WaveBand = "ocean" | "local" | "open";

export type WaveComponent = {
  /** Which of the three seas it is part of. */
  readonly band: WaveBand;
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
  /** The spatial phase over the level, rad — the eikonal |∇φ| = k(d)
   * from the plane wave at the rim, so the shallows' shortening and the
   * turning round the land are both in it, and its gradient is the local
   * wave vector. Null for the LOCAL band, whose waves are too short to
   * feel any bed a hull can float over, and for the OPEN band, which
   * stands in ocean the level's grid does not cover: both read the
   * deep-water plane wave k₀·(d̂·x) instead. */
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
  /** The level's bounds — where its grid, and so the coast it describes,
   * stops. Everything past them is the OPEN band's ocean (`ocean.ts`), and
   * the sea is the one thing that has to know: a hull reads the edge of the
   * world off `level.bounds` itself. */
  readonly bounds: Bounds;
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
  /** ...and the OPEN band's, the storm past the level's rim (`ocean.ts`):
   * the height it is quoted at, m, and the period that height earns. 0 on a
   * calm level, which has no storm out at sea. */
  readonly openHs: number;
  readonly openTp: number;
  /** Every component of every band, LONGEST FIRST — an order `surfaceAt`'s
   * `count` depends on, since a caller asking for the first few components
   * is asking for the swell, and the open band's storm swell is the longest
   * thing in the field. Each one says which band it belongs to. */
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
  band: WaveBand,
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
      band,
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
  const ocean = layBand(
    rng,
    "ocean",
    hsRef,
    tp,
    S.components,
    S.bandLow,
    bandHigh,
    travel,
    level.ground,
  );

  // ── The local band ────────────────────────────────────────────────────
  // Quoted once for the level, at the MEAN wind over `localFetch` — the
  // same reference `shelter.chop` is a share of, so the two cannot drift.
  const localHs = fetchHeight(u, S.localFetch) * S.heightScale;
  const localTp = fetchPeriod(u, S.localFetch) * S.periodScale;
  const local = layBand(
    rng,
    "local",
    localHs,
    localTp,
    S.localComponents,
    S.localBandLow,
    S.localBandHigh,
    travel,
    null,
  );

  // ── The open band ─────────────────────────────────────────────────────
  // The storm past the edge of the level (`ocean.ts`). Quoted by its HEIGHT
  // and not grown, because out there the fetch law has nothing left to say:
  // the coast the level is a piece of is kilometres astern and the sea is
  // whatever weather the game says is out at sea. A sea quoted by its
  // height takes its period — and so its WAVELENGTH, and so the angle of
  // the face, which is what a rider reads — from `sea.steepness`, exactly
  // as a `SeaOverride` does. A run already handed a bigger sea than the
  // storm keeps it rather than riding out into calmer water.
  //
  // Drawn LAST so that every component of the other two bands, and every
  // digest that replays one, is the draw it always was; a calm level gets
  // no storm at all, which keeps "zero wind is zero sea" true out here too.
  const openHs = u > 0 ? Math.max(S.open.hs, hsRef) : 0;
  const openTp = periodForHeight(openHs);
  const open =
    openHs > 0
      ? layBand(
          rng,
          "open",
          openHs,
          openTp,
          S.components,
          S.bandLow,
          Math.max(S.bandHigh, openTp / S.minPeriod),
          travel,
          null,
        )
      : [];

  return {
    windSpeed: u,
    windFrom: wind.from,
    bounds: level.bounds,
    shelter,
    fetchRef,
    hsRef,
    tp,
    localHs,
    localTp,
    openHs,
    openTp,
    // Longest first across all three bands: the open band's storm swell
    // reaches past four hundred metres and the local band's chop stops at
    // two, so only a sort puts "the first few components" and "the swell"
    // back together. Inside a level the open band's share is 0 and every
    // one of its components is skipped, so the sum a coast's water returns
    // is term for term the one it returned before there was a storm.
    components: [...ocean, ...local, ...open].sort((a, b) => a.k0 - b.k0),
  };
}

/** What share of each band stands at a plan point.
 *
 * Across the coast, the OCEAN band's is the point's exposure to the open
 * sea and the LOCAL band's is what is left over, times the chop the
 * sheltered wind grows on the point's own water: they partition rather than
 * add, so no water is dealt two seas.
 *
 * Out past the level's rim the OPEN band takes over from the ocean band on
 * the storm's ramp (`ocean.ts`), and the handover is written so that the
 * SIGNIFICANT HEIGHT grows straight from the coast's own sea to the storm's
 * `openHs` — the ocean band fades by `1 − storm` and the open band's share
 * is whatever carries the rest of the height in energy. That keeps the sea
 * building monotonically the whole way out instead of dipping where the two
 * spectra cross, and it is why the open band has no share of its own to
 * tune. `storm` is 0 everywhere inside a level, so all three shares there
 * are exactly what they were before there was an ocean beyond the rim. */
export function seaShares(
  sea: SeaState,
  x: number,
  z: number,
  storm: number = stormAt(sea.bounds, x, z),
): { ocean: number; local: number; open: number } {
  const exposure = clamp(sampleField(sea.shelter.exposure, x, z), 0, 1);
  const local = (1 - exposure) * Math.max(0, sampleField(sea.shelter.chop, x, z));
  if (storm <= 0) return { ocean: exposure, local, open: 0 };
  // The coast's own sea here, what is left of it, and the height the storm
  // has to make up: Hs² = (coast carried)² + (openHs · open)².
  const coast = sea.hsRef * exposure;
  const carried = coast * (1 - storm);
  const target = coast + Math.max(0, sea.openHs - coast) * storm;
  const open =
    sea.openHs > 0 ? Math.sqrt(Math.max(0, target * target - carried * carried)) / sea.openHs : 0;
  return { ocean: exposure * (1 - storm), local, open };
}

/** The sea's headline numbers at a plan point: significant height (m — the
 * three bands summed in energy, before the bed clips them) and the peak
 * period (s) of whichever band is carrying the most of it there. Which is
 * why a river reads a tenth of a metre at a second and a half where the
 * water off the beach reads a metre and a half at four, and why two
 * kilometres out to sea reads twenty metres at twelve. */
export function seaSummary(sea: SeaState, x: number, z: number): { Hs: number; Tp: number } {
  const { ocean, local, open } = seaShares(sea, x, z);
  const hsOcean = sea.hsRef * ocean;
  const hsLocal = sea.localHs * local;
  const hsOpen = sea.openHs * open;
  const Tp =
    hsOpen >= hsOcean && hsOpen >= hsLocal ? sea.openTp : hsOcean >= hsLocal ? sea.tp : sea.localTp;
  return { Hs: Math.hypot(hsOcean, hsLocal, hsOpen), Tp };
}

const scratch = new Float64Array(3);
/** A phase sample and its gradient — the component's local wave vector. */
const phaseAt = new Float64Array(3);
/** Three numbers a component — the local wavenumber, the amplitude it
 * actually stands at here, and coth(k·d) — kept between the two passes
 * below so the depth table is read once per component rather than twice. */
const held = new Float64Array(3 * (2 * S.components + S.localComponents));
const drift = { x: 0, z: 0 };
/** How far out of the level's bounds the sample lies, per axis (`ocean.ts`). */
const beyond = new Float64Array(2);

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
  // HOW FAR PAST THE LEVEL this is (`ocean.ts`) — zero for every sample a
  // course is ridden over, and the one number the storm's sea, its bed and
  // its wind are all read off.
  const past = oceanOffset(sea.bounds, x, z, beyond);
  const storm = past > 0 ? stormRamp(past) : 0;
  // `bedAt`, inlined: the storm's ramp is already in hand here.
  const depth = Math.max(oceanDepth(-sampleField(level.ground, x, z), storm), S.minDepth);
  // `seaShares`, inlined: this is called thousands of times a frame by the
  // renderer's water grid and twelve times a step by the hull, and an object
  // returned per call is an allocation on every one of them.
  const exposure = clamp(sampleField(sea.shelter.exposure, x, z), 0, 1);
  const local = (1 - exposure) * Math.max(0, sampleField(sea.shelter.chop, x, z));
  let ocean = exposure;
  let open = 0;
  if (storm > 0 && sea.openHs > 0) {
    const coast = sea.hsRef * exposure;
    const carried = coast * (1 - storm);
    const target = coast + Math.max(0, sea.openHs - coast) * storm;
    ocean = exposure * (1 - storm);
    open = Math.sqrt(Math.max(0, target * target - carried * carried)) / sea.openHs;
  }
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
  // multiplied by zero, and that is most of every sample: over a course the
  // open band is absent and so is the local one, up a river the ocean band
  // is, and out in the storm the coast's is, so almost all water pays for
  // ONE band of the three. The threshold is a thousandth of a quoted sea —
  // under a millimetre of water, which is nothing a hull or an eye can tell
  // from none.
  const comps = sea.components;
  const total = comps.length;
  const n = Math.min(count, total);
  let m0 = 0;
  for (let i = 0; i < total; i++) {
    const c = comps[i];
    const share = c.band === "ocean" ? ocean : c.band === "local" ? local : open;
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
    // The ocean band's phase is the eikonal over the bed, so its
    // wavelength shortens toward the shore and its crests turn with the
    // depth and round the land; the LOCAL WAVE VECTOR is that field's
    // gradient, and it is what the slope and the orbital motion follow.
    // The local and open bands are plane waves — the same thing for a wave
    // that never feels a bottom — and their wave vector is their heading's.
    let spatial: number;
    let kx: number;
    let kz: number;
    if (c.phaseField) {
      sampleFieldGradient(c.phaseField, x, z, phaseAt);
      spatial = phaseAt[0];
      kx = phaseAt[1];
      kz = phaseAt[2];
      // PAST THE RIM the field has run out, and the sampler clamps: its
      // value stops changing along the axis the sample left the grid by and
      // its gradient there is zero, which is a wave standing still in the
      // water. So the rim's own phase is carried on outward at the local
      // rate along the component's heading — continuous, because the field
      // was seeded at the rim with exactly that plane wave (the seaward rim
      // is the one a wave comes IN over under R12), and travelling, because
      // the wave vector out there is the heading's. The same carry-on
      // `buildPhaseField` uses to fill the cells no sweep reaches.
      if (past > 0) {
        spatial += k * (c.dirX * beyond[0] + c.dirZ * beyond[1]);
        if (beyond[0] !== 0) kx = k * c.dirX;
        if (beyond[1] !== 0) kz = k * c.dirZ;
      }
    } else {
      spatial = c.k0 * (c.dirX * x + c.dirZ * z);
      kx = k * c.dirX;
      kz = k * c.dirZ;
    }
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
    // Slope from the wave vector (the amplitude's own gradient is a
    // shoaling effect too slow to tilt the surface), with the crest
    // correction's own slope on it: d/dφ[−½·k·a²·cos 2φ] = k·a²·sin 2φ.
    const dEta = a * cos + 2 * peak * Math.sin(2 * phase);
    sx += dEta * kx;
    sz += dEta * kz;
    // Orbital velocity at the surface (Airy): horizontal a·ω·coth(kd) in
    // phase with the height, along the wave vector; vertical −a·ω·cos φ
    // (the surface's own rate). The wave vector is divided by the depth's
    // own k rather than normalised, so a crease in the field, where two
    // arrivals meet, carries less water rather than water sent anywhere.
    const horizontal = (a * c.omega * held[i * 3 + 2] * sin) / k;
    vx += horizontal * kx;
    vz += horizontal * kz;
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
