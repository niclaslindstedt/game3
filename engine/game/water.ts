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
// - THERE ARE THREE KINDS OF BAND, because there are three kinds of water a
//   rider can reach and they do not carry the same waves.
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
//     THE OPEN BANDS are the storm out past the edge of the built level
//     (`ocean.ts`) — one band per rung of `TUNING.sea.open.ladder`, from
//     the twenty-metre sea a couple of kilometres out to the thousand-metre
//     one two hundred kilometres past it. Seaward of the grid there is no
//     coast left to shelter anything and no fetch left to grow a sea over,
//     so these are QUOTED rather than grown, each at its own height and the
//     period `periodForHeight` gives THAT height — which is the whole
//     reason there is a rung per height rather than one band scaled up and
//     down (`SeaBand`). Their shares rise along the ladder while the OCEAN
//     band's falls away over the first rung, so the sea a rider is in grows
//     steadily the further out he holds the throttle open. Inside the level
//     every one of their shares is exactly zero, and the whole ladder costs
//     ONE comparison per sample, because `surfaceAt` walks the field band
//     by band and skips a band rather than a component.
//
//   Neither the local nor the open bands carry a phase field. A five-metre
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
// - WHAT THE BED DOES to a component — the dispersion relation its
//   wavenumber follows, the shoaling that grows it, the depth table both
//   are precomputed into, and the eikonal phase field that turns its crests
//   toward the shallows and wraps them into a river mouth — is
//   `wave-bed.ts`, which is the half of this model that reads the ground.
//   Each component keeps ONE frequency; everything else about it follows
//   the depth at the point it is sampled at.
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
//   water, and a rider who simply rides out far enough meets a thousand.
//   Every term here — the depth table, the phase field, the orbital
//   velocity — is sized to carry it (`tests/waves_test.ts`'s storm case
//   and its ladder cases).
//
// Deterministic: the seed fixes the phases and the directional draws, and
// t is the only clock.

import { sampleField, sampleFieldGradient, type Heightfield } from "../lib/heightfield.ts";
import { clamp, TAU } from "../lib/math.ts";
import { createRng, type Rng } from "../lib/prng.ts";
import { flowAt } from "../mapgen/flow.ts";
import type { Bounds, Level, Wind } from "../mapgen/types.ts";
import { TUNING } from "./defs/tuning.ts";
import { createShelter, effectiveFetch, fetchHeight, fetchPeriod, type Shelter } from "./fetch.ts";
import { coastAstern, oceanDepth, oceanOffset, oceanOut, stormRamp } from "./ocean.ts";
import { buildPhaseField, buildTable, tableAt } from "./wave-bed.ts";

const S = TUNING.sea;
const O = TUNING.sea.open;
const G = TUNING.g;

/** WHICH SEA a component belongs to, and so which share it stands at —
 * the three in the header: the coast's own ocean swell, the chop on water
 * that swell cannot reach, and the storm past the edge of the level. */
export type WaveBand = "ocean" | "local" | "open";

export type WaveComponent = {
  /** Which of the three seas it is part of. */
  readonly band: WaveBand;
  /** ...and WHICH BAND, as a position in `SeaState.bands`: there is one
   * ocean band and one local band, and one open band per rung of the storm
   * ladder. `surfaceAt` reads the band's share by this index rather than by
   * comparing the name. */
  readonly bandIndex: number;
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
  /** Per depth row (row `i` at (i·`TUNING.sea.tableRoot`)² metres): local
   * wavenumber k (rad/m), shoaling coefficient Ks, and coth(k·d) for the
   * orbital velocity — three floats a row. */
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
  /** ...and the TOP of the storm ladder past the level's rim (`ocean.ts`):
   * the height the biggest open band is quoted at, m, and the period that
   * height earns. 0 on a calm level, which has no storm out at sea. */
  readonly openHs: number;
  readonly openTp: number;
  /** Every band of the field: the ocean's, the local one, and one per rung
   * of the storm ladder. `surfaceAt` walks THIS and skips a whole band
   * whose share is nothing — which is every open band on every sample a
   * course is ridden over, and most of the cost of carrying a ladder that
   * only stands kilometres out at sea. */
  readonly bands: readonly SeaBand[];
  /** Every component of every band, LONGEST FIRST — an order `surfaceAt`'s
   * `count` depends on, since a caller asking for the first few components
   * is asking for the swell, and the storm's swell is the longest thing in
   * the field. Each one says which band it belongs to. */
  readonly components: readonly WaveComponent[];
};

/** ONE BAND of the field: the sea it was quoted at, and where its
 * components sit in `SeaState.components`.
 *
 * The ocean band is the coast's own sea and the local band is the chop on
 * water it cannot reach; the rest are the STORM LADDER's rungs
 * (`TUNING.sea.open.ladder`), one band each. A ladder rather than one big
 * band because a sea quoted by its height takes its WAVELENGTH from that
 * height (`periodForHeight`), so a single band laid at the thousand-metre
 * top rung and scaled down to the twenty-metre sea a rider meets two
 * kilometres out would deal him a thirteen-kilometre wave with a fiftieth
 * of its proper face — an ocean tilting, not a wave. Each rung carries its
 * own height at its own steepness, and neighbouring rungs hand over on the
 * HEIGHT the way the coast's sea and the storm already do. */
export type SeaBand = {
  readonly kind: WaveBand;
  /** The significant height, m, and peak period, s, the band was laid at. */
  readonly hs: number;
  readonly tp: number;
  /** Positions in `SeaState.components` — which is sorted by wavenumber, so
   * a band's components are scattered through it. */
  readonly at: Int32Array;
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
  bandIndex: number,
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
      bandIndex,
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
    0,
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
    1,
    localHs,
    localTp,
    S.localComponents,
    S.localBandLow,
    S.localBandHigh,
    travel,
    null,
  );

  // ── The open bands: the STORM LADDER ──────────────────────────────────
  // The storm past the edge of the level (`ocean.ts`), one band per rung of
  // `TUNING.sea.open.ladder`. Quoted by their HEIGHT and not grown, because
  // out there the fetch law has nothing left to say: the coast the level is
  // a piece of is kilometres astern and the sea is whatever weather the
  // game says is out at sea. A sea quoted by its height takes its period —
  // and so its WAVELENGTH, and so the angle of the face, which is what a
  // rider reads — from `sea.steepness`, exactly as a `SeaOverride` does,
  // which is the whole reason there is a rung per height rather than one
  // band scaled up and down (`SeaBand`). A run already handed a bigger sea
  // than a rung keeps its own rather than riding out into calmer water.
  //
  // Drawn LAST so that every component of the other two bands, and every
  // digest that replays one, is the draw it always was; a calm level gets
  // no storm at all, which keeps "zero wind is zero sea" true out here too.
  const rungs: { hs: number; tp: number; comps: WaveComponent[] }[] = [];
  if (u > 0) {
    for (const [, rungHs] of O.ladder) {
      const hs = Math.max(rungHs, hsRef);
      const rungTp = periodForHeight(hs);
      rungs.push({
        hs,
        tp: rungTp,
        comps: layBand(
          rng,
          "open",
          2 + rungs.length,
          hs,
          rungTp,
          S.components,
          S.bandLow,
          O.bandHigh,
          travel,
          null,
        ),
      });
    }
  }
  const top = rungs[rungs.length - 1];

  // Longest first across every band: the storm's swell reaches kilometres
  // and the local band's chop stops at two metres, so only a sort puts "the
  // first few components" and "the swell" back together. Inside a level
  // every open band's share is 0 and the whole ladder is skipped, so the
  // sum a coast's water returns is term for term the one it returned before
  // there was an ocean beyond the rim.
  const components = [...ocean, ...local, ...rungs.flatMap((r) => r.comps)].sort(
    (a, b) => a.k0 - b.k0,
  );
  const bandOf = (index: number, kind: WaveBand, hs: number, bandTp: number): SeaBand => {
    const at: number[] = [];
    for (let i = 0; i < components.length; i++) {
      if (components[i].bandIndex === index) at.push(i);
    }
    return { kind, hs, tp: bandTp, at: Int32Array.from(at) };
  };

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
    openHs: top ? top.hs : 0,
    openTp: top ? top.tp : periodForHeight(0),
    bands: [
      bandOf(0, "ocean", hsRef, tp),
      bandOf(1, "local", localHs, localTp),
      ...rungs.map((r, i) => bandOf(2 + i, "open", r.hs, r.tp)),
    ],
    components,
  };
}

/** What share the three KINDS of band stand at at a plan point: the coast's
 * own sea, the chop on water it cannot reach, and the storm ladder as a
 * whole — the open rungs summed in energy and quoted as a fraction of the
 * ladder's top, so the number still reads "how much of the full storm
 * stands here".
 *
 * `fillShares` below is where all of it is decided, rung by rung; this is
 * the reading of it a lab or a test wants. `storm` is 0 everywhere inside a
 * level, so the three shares there are exactly what they were before there
 * was an ocean beyond the rim. */
export function seaShares(
  sea: SeaState,
  x: number,
  z: number,
  out: number = oceanOut(sea.bounds, x, z),
): { ocean: number; local: number; open: number } {
  fillShares(sea, x, z, out, shares);
  let openHs = 0;
  for (let b = 2; b < sea.bands.length; b++) {
    const hs = shares[b] * sea.bands[b].hs;
    openHs += hs * hs;
  }
  return {
    ocean: shares[0],
    local: shares[1],
    open: sea.openHs > 0 ? Math.sqrt(openHs) / sea.openHs : 0,
  };
}

/** `seaSummary` for the STORM ALONE — the open bands of the ladder summed in
 * energy, at the period of whichever rung is carrying them, and nothing of
 * the coast's own sea. Both 0 everywhere inside a level, which is what lets
 * a caller take the bigger of this and the level's own headline sea and
 * change nothing about any water a course is ridden over.
 *
 * It is what a renderer needs to judge a crest out there: how high a wave
 * stands, and how steep it is, are both read against the sea it stands IN,
 * and thresholds set by a one-metre coastal swell paint a thousand-metre
 * sea entirely white. Written into `out` rather than returned, so the water
 * mesh can ask once a frame without allocating. */
export function stormSeaAt(
  sea: SeaState,
  x: number,
  z: number,
  out: { Hs: number; Tp: number },
): { Hs: number; Tp: number } {
  fillShares(sea, x, z, oceanOut(sea.bounds, x, z), shares);
  let m0 = 0;
  let biggest = 0;
  out.Tp = 0;
  for (let b = 2; b < sea.bands.length; b++) {
    const hs = shares[b] * sea.bands[b].hs;
    m0 += hs * hs;
    if (hs >= biggest) {
      biggest = hs;
      out.Tp = sea.bands[b].tp;
    }
  }
  out.Hs = Math.sqrt(m0);
  if (out.Hs <= 0) out.Tp = 0;
  return out;
}

/** The share every band of the field stands at at a plan point, by the same
 * index as `SeaState.bands` — the whole handover, rung by rung, rather than
 * `seaShares`' reading of it in three numbers. Allocates, so it is for a
 * lab or a test asking which rung of the storm ladder is carrying the sea,
 * never for the hull or the water mesh. */
export function seaBandShares(sea: SeaState, x: number, z: number): Float64Array {
  fillShares(sea, x, z, oceanOut(sea.bounds, x, z), shares);
  return shares.slice(0, sea.bands.length);
}

/** The share EVERY band stands at, written into `out` by band index — the
 * one place the handover between the coast's sea and the storm ladder is
 * decided, read by `seaShares`, `seaSummary` and `surfaceAt` alike.
 *
 * Across the coast it is the partition above: exposure to the ocean band,
 * what is left over to the local one. Out past the rim the ocean band fades
 * by `1 − storm` and the LADDER makes up the rest of the height in energy:
 * Hs² = (coast carried)² + Σ (rung hs · its share)². That keeps the sea
 * building monotonically the whole way out instead of dipping where two
 * spectra cross, and it is why no open band has a share of its own to tune.
 *
 * WHICH rungs carry it is the second half. The ramp is the ladder's own
 * height profile (`stormRamp`), so the height standing here sits between
 * two rungs, and those two — and only those two — share the energy, by how
 * far between them it is. Below the first rung that rung takes all of it,
 * which is exactly what the single open band did before there was a ladder.
 * The wavelength a rider reads therefore walks up the ladder with the
 * height rather than jumping between rungs.
 *
 * Writes rather than returns: `surfaceAt` calls it tens of thousands of
 * times a frame under the renderer's water grid. */
function fillShares(sea: SeaState, x: number, z: number, past: number, out: Float64Array): void {
  const bands = sea.bands;
  out.fill(0, 0, bands.length);
  const exposure = clamp(sampleField(sea.shelter.exposure, x, z), 0, 1);
  out[1] = (1 - exposure) * Math.max(0, sampleField(sea.shelter.chop, x, z));
  if (past <= 0 || bands.length <= 2 || sea.openHs <= 0) {
    out[0] = exposure;
    return;
  }
  // The coast's own sea, fading out as the coast goes ASTERN — the short
  // ramp, done with by the ladder's first rung — and the storm standing
  // over it, which is the ladder's own height (`stormRamp` is its profile).
  const astern = coastAstern(past);
  const coast = sea.hsRef * exposure;
  const carried = coast * (1 - astern);
  out[0] = exposure * (1 - astern);
  const storm = stormRamp(past);
  // Hs² = carried² + need², and the sea here is what is left of the coast's
  // plus the storm over it — so at every rung, where the coast is long
  // gone, the sea is that rung's own authored metre and nothing else.
  const target = carried + sea.openHs * storm;
  const need = Math.sqrt(Math.max(0, target * target - carried * carried));
  if (need <= 0) return;
  // WHICH rungs carry it. Each rung's own place on the ramp is its height
  // over the ladder's top, by construction of `stormRamp`, so the height
  // standing here sits between two of them — and those two share it.
  let r = 2;
  let below = 0;
  while (r < bands.length - 1 && storm > bands[r].hs / sea.openHs) {
    below = bands[r].hs / sea.openHs;
    r++;
  }
  const here = bands[r].hs / sea.openHs;
  const f = r === 2 ? 1 : clamp((storm - below) / (here - below), 0, 1);
  // Energy, not height: two rungs at f and 1 − f of it carry exactly `need`
  // between them, whatever their own quoted heights are.
  out[r] = (need * Math.sqrt(f)) / bands[r].hs;
  if (f < 1) out[r - 1] = (need * Math.sqrt(1 - f)) / bands[r - 1].hs;
}

/** The sea's headline numbers at a plan point: significant height (m — every
 * band summed in energy, before the bed clips them) and the peak period (s)
 * of whichever band is carrying the most of it there. Which is why a river
 * reads a tenth of a metre at a second and a half where the water off the
 * beach reads a metre and a half at four, why two kilometres out to sea
 * reads twenty metres at twelve, and why two hundred kilometres out it
 * reads a thousand metres at eighty-four. */
export function seaSummary(sea: SeaState, x: number, z: number): { Hs: number; Tp: number } {
  fillShares(sea, x, z, oceanOut(sea.bounds, x, z), shares);
  let m0 = 0;
  let biggest = 0;
  let Tp = sea.tp;
  for (let b = 0; b < sea.bands.length; b++) {
    const hs = shares[b] * sea.bands[b].hs;
    m0 += hs * hs;
    // Ties go to the LONGER band: the ocean's swell over the chop riding on
    // it, and the rung a rider is climbing to over the one he has left.
    if (hs >= biggest) {
      biggest = hs;
      Tp = sea.bands[b].tp;
    }
  }
  return { Hs: Math.sqrt(m0), Tp };
}

const scratch = new Float64Array(3);
/** A phase sample and its gradient — the component's local wave vector. */
const phaseAt = new Float64Array(3);
/** Three numbers a component — the local wavenumber, the amplitude it
 * actually stands at here, and coth(k·d) — kept between the two passes
 * below so the depth table is read once per component rather than twice.
 *
 * Sized for the whole field: the ocean band, the local band, and one open
 * band per rung of the storm ladder. A typed array silently DROPS a write
 * past its end and reads `undefined` back, so a band added without this
 * growing with it is not an error but a surface full of NaN — and a
 * `surfaceAt` ten times slower for the deopt. */
const held = new Float64Array(3 * (S.components * (1 + O.ladder.length) + S.localComponents));
/** Every band's share at the sample, by band index (`fillShares`). */
const shares = new Float64Array(2 + O.ladder.length);
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
  // What every band stands at here. Written into a shared array rather than
  // returned, because this is called thousands of times a frame by the
  // renderer's water grid and twelve times a step by the hull, and an
  // object returned per call is an allocation on every one of them.
  fillShares(sea, x, z, past, shares);
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
  // BAND BY BAND rather than component by component, because a band whose
  // share here is nothing is then skipped in one compare instead of eight,
  // and that is most of every sample: over a course the whole storm ladder
  // is absent and so is the local band, up a river the ocean band is, and
  // out in the storm the coast's is and all but two rungs of the ladder
  // are. So almost all water pays for ONE band of the eight, and carrying a
  // ladder that only stands kilometres out at sea costs a course nothing.
  // The threshold is a thousandth of a quoted sea — under a millimetre of
  // water, which is nothing a hull or an eye can tell from none.
  //
  // A skipped band leaves STALE numbers in `held`, and they are never read:
  // the second pass walks the components in wavelength order and asks the
  // same question of the share before it touches one. Clearing the array
  // instead would be the whole ladder's worth of writes on every sample of
  // every course, which is the cost this loop exists to avoid.
  const comps = sea.components;
  const total = comps.length;
  const n = Math.min(count, total);
  let m0 = 0;
  for (let b = 0; b < sea.bands.length; b++) {
    const share = shares[b];
    if (share <= 1e-3) continue;
    const at = sea.bands[b].at;
    for (let j = 0; j < at.length; j++) {
      const i = at[j];
      const c = comps[i];
      tableAt(c.table, depth, scratch);
      const a = c.amp * scratch[1] * share;
      held[i * 3] = scratch[0];
      held[i * 3 + 1] = a;
      held[i * 3 + 2] = scratch[2];
      m0 += a * a;
    }
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
  // Band by band again, and for the same reason: over a course this walks
  // thirteen components rather than every rung of a ladder that is not
  // standing. `count` still means "the longest n of the field", because a
  // band's positions are its own ascending run through the sorted array —
  // so the first that reaches `n` ends that band.
  for (let b = 0; b < sea.bands.length; b++) {
    if (shares[b] <= 1e-3) continue;
    const at = sea.bands[b].at;
    for (let j = 0; j < at.length; j++) {
      const i = at[j];
      if (i >= n) break;
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
