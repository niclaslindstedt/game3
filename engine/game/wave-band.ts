// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HOW A BAND OF COMPONENTS IS LAID over a spectrum — the half of the wave
// model that turns "a sea this high with a peak this long" into the handful
// of sines `water.ts` sums.
//
// A band is a significant height, a peak period and a span of frequency
// about it, and laying one is three decisions, each of which has been the
// whole difference between water that reads as a sea and water that does
// not:
//
//   WHERE THE SLICES SIT. One component per slice of the band, and the
//   slices are cut by ENERGY rather than by frequency (`energySlices`,
//   `TUNING.sea.sliceMix`), so they crowd onto the peak where a JONSWAP sea
//   keeps most of its energy. Three or four of them within a tenth of the
//   peak carry ONE wave train between them whose beat is hundreds of metres
//   long; cut evenly in frequency instead and the peak is a single sine
//   with its neighbour an octave off, and the two beat against each other
//   inside the water a rider can see.
//
//   WHICH WAY EACH ONE POINTS. Drawn THROUGH the cos² directional spread by
//   inverse transform (`spreadQuantile`), one equal-energy stratum each, so
//   the fan is even and every component carries a real share of the sea —
//   never drawn flat with the cos² folded into the component's ENERGY,
//   which robs whatever lands at the edge of the fan and lets its
//   neighbours take everything.
//
//   HOW WIDE THAT FAN IS at each frequency (`spreadAt`): narrowest at the
//   peak, opening above it, so short chop rides confused over ordered
//   swell.
//
// Nothing here reads the bed or the clock — a band is laid ONCE per level
// and `water.ts` samples what comes out. What the bed then does to each
// component is `wave-bed.ts`.

import { clamp, TAU } from "../lib/math.ts";
import type { Rng } from "../lib/prng.ts";
import { type Heightfield } from "../lib/heightfield.ts";
import { TUNING } from "./defs/tuning.ts";
import { buildPhaseField, buildTable } from "./wave-bed.ts";
import type { WaveBand, WaveComponent } from "./water.ts";

const S = TUNING.sea;
const G = TUNING.g;

/** JONSWAP spectral density S(ω), unnormalised (α dropped: the amplitudes
 * are scaled to Hs afterwards), for peak frequency `wp`. Hasselmann et
 * al. 1973: ω⁻⁵·exp(−1.25·(ω_p/ω)⁴)·γ^r, σ = 0.07 below the peak and 0.09
 * above it. γ is `TUNING.sea.peakEnhancement` — at 1 this is
 * Pierson–Moskowitz, the broad fully developed sea. */
export function jonswap(w: number, wp: number): number {
  const sigma = w <= wp ? 0.07 : 0.09;
  const r = Math.exp(-((w - wp) * (w - wp)) / (2 * sigma * sigma * wp * wp));
  return Math.pow(w, -5) * Math.exp(-1.25 * Math.pow(wp / w, 4)) * Math.pow(S.peakEnhancement, r);
}

/** The directional half-width at `omega`, radians: `TUNING.sea.spread` at
 * and below the peak, opening above it by `spreadTilt` (Mitsuyasu et al.
 * 1975; Hasselmann et al. 1980 — the spreading parameter peaks at f_p, so
 * the FAN is narrowest there), and held under `spreadMax`, past which a
 * component is no longer part of this wind's sea and the eikonal has only
 * one rim to sweep it from.
 *
 * Flat below the peak on purpose: the measurements have the fan opening
 * that way too, but this band's floor is 0.7 f_p and fanning the longest,
 * most energetic components is what stops a wave FRONT forming — which is
 * the whole of what a rider reads as a wave. The dial says why. */
function spreadAt(omega: number, wp: number, peak: number = S.spread): number {
  const r = Math.max(1e-6, omega / wp);
  return r <= 1 ? peak : Math.min(peak * Math.pow(r, S.spreadTilt), S.spreadMax);
}

/** The cos² spread's own quantile: the offset, as a FRACTION of the
 * half-width, below which `u` of the band's energy lies. The density is
 * cos²(π·v/2) over v ∈ [−1, 1] (Longuet-Higgins et al. 1963, truncated),
 * so its integral is (v + sin(π·v)/π + 1)/2 — monotone, with no closed
 * inverse, and bisected here because this runs once per component at build
 * time and never again.
 *
 * Drawing the heading THROUGH this, rather than uniformly with the cos² as
 * a weight on the component's energy, is what keeps a band from lumping:
 * weighted, a component that lands at the edge of the fan is handed nearly
 * no energy and the ones near the middle take the whole sea, which is a
 * corduroy of two or three waves however many were laid. */
function spreadQuantile(u: number): number {
  const target = 2 * clamp(u, 0, 1) - 1;
  let lo = -1;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (mid + Math.sin(Math.PI * mid) / Math.PI < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** The integers 0..n−1 in a seeded order (Fisher–Yates). The headings are
 * drawn one per equal-energy STRATUM of the spread, and this is which
 * component gets which: without it the band's longest wave would sit at one
 * edge of the fan on every level and the shortest at the other, a rake
 * across the sea rather than a sea. */
function strata(rng: Rng, n: number): Int32Array {
  const order = new Int32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  for (let i = n - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const swap = order[i];
    order[i] = order[j];
    order[j] = swap;
  }
  return order;
}

/** Where to cut a band into `n` slices of EQUAL ENERGY, and where each
 * slice's weight sits inside it: the spectrum's own cumulative curve over
 * `[low, high]` multiples of the peak, inverted at every i/n, with each
 * slice's energy centroid beside it.
 *
 * This is the whole reason a sea of eight components does not repeat. Cut
 * into equal slices of FREQUENCY instead and the peak — where a JONSWAP
 * sea keeps most of its energy — is carried by one component, which is one
 * sine: the wave a rider reads is then a single wavelength, and the nearest
 * frequency to beat against it is a whole slice away, so the pattern comes
 * round inside the water he can see. Cut by energy and the slices crowd in
 * on the peak, three or four of them within a tenth of it: they carry ONE
 * wave train between them, and the beat of frequencies that close is
 * hundreds of metres long. The tail gets the two or three wide slices it
 * deserves, which is the texture riding on top.
 *
 * The centroid rather than the slice's middle because a wide tail slice
 * holds its energy at the LOW end: a component standing at the middle of
 * it would carry a whole slice's amplitude at a wavenumber the slice does
 * not really have, which is how a tail component ends up steeper than any
 * wave stands. Returns `n + 1` edges followed by `n` centroids, all as
 * multiples of the peak frequency. */
function energySlices(n: number, low: number, high: number, mix: number): Float64Array {
  // The density on a fine log grid, once — 256 steps over a band under two
  // octaves wide is a thousandth of the total in the worst cell. Two
  // running sums: the true ENERGY (which places the centroids and scales
  // the amplitudes) and the energy raised to `sliceMix` (which places the
  // EDGES). The exponent is the whole dial between the two ways of cutting
  // a band, and both ends of it are a real thing: at 0 the cut is even in
  // log frequency, which is a plain octave ladder; at 1 it is even in
  // energy. Slicing by energy is what crowds the slices onto the peak, and
  // it must be short of 1 because a slice is finally represented by ONE
  // sine — so the WIDEST slice, out in the tail where an octave of band
  // holds its eighth of the sea, would stand that eighth up as a single
  // wave at a wavenumber the slice as a whole does not have. That is the
  // only way this cut can hand out a component steeper than a wave stands
  // (`tests/waves_test.ts` sweeps every band for it).
  const STEPS = 256;
  const cum = new Float64Array(STEPS + 1);
  const raw = new Float64Array(STEPS + 1);
  const mom = new Float64Array(STEPS + 1);
  const step = Math.pow(high / low, 1 / STEPS);
  for (let i = 0; i < STEPS; i++) {
    const a = low * Math.pow(step, i);
    const b = a * step;
    const mid = Math.sqrt(a * b);
    const e = jonswap(mid, 1) * (b - a);
    cum[i + 1] = cum[i] + Math.pow(e, mix);
    raw[i + 1] = raw[i] + e;
    mom[i + 1] = mom[i] + e * mid;
  }
  const total = cum[STEPS];
  const out = new Float64Array(2 * n + 1);
  out[0] = low;
  out[n] = high;
  // The edges: where the cumulative curve crosses each i/n, read between
  // the two cells it falls in.
  let at = 0;
  for (let i = 1; i < n; i++) {
    const target = (total * i) / n;
    while (at < STEPS && cum[at + 1] < target) at++;
    const span = cum[at + 1] - cum[at];
    const f = span > 0 ? (target - cum[at]) / span : 0;
    out[i] = low * Math.pow(step, at + f);
  }
  // ...and each slice's energy centroid, off the true-energy sums.
  const readAt = (w: number): { c: number; m: number } => {
    const x = Math.log(w / low) / Math.log(step);
    const i = Math.min(STEPS - 1, Math.max(0, Math.floor(x)));
    const f = Math.min(1, Math.max(0, x - i));
    return { c: raw[i] + f * (raw[i + 1] - raw[i]), m: mom[i] + f * (mom[i + 1] - mom[i]) };
  };
  for (let i = 0; i < n; i++) {
    const a = readAt(out[i]);
    const b = readAt(out[i + 1]);
    const e = b.c - a.c;
    out[n + 1 + i] = e > 0 ? (b.m - a.m) / e : Math.sqrt(out[i] * out[i + 1]);
  }
  return out;
}

/** Lay one band of components over a JONSWAP spectrum: `n` of them, one per
 * slice of equal ENERGY over `[low, high]` multiples of the peak
 * (`energySlices`), travelling `travel` with a cos² directional spread
 * about it (Longuet-Higgins et al. 1963), and scaled so that 4·√m0 = `hs`.
 *
 * Both draws are STRATIFIED — a frequency about its own slice's centroid, a
 * heading inside its own slice of the spread rather than anywhere in the
 * fan. A sum of a handful of sines is only as unrepetitive as its
 * components are unalike, and a fixed ladder of frequencies all running one
 * way beats against itself into a pattern that repeats down the wind —
 * which is what a rider sees on calm water, where the swell is all there is.
 *
 * `ground` is the bed the phase field is integrated over, or null for a
 * band short enough to be a plane wave everywhere a hull can float.
 */
export function layBand(
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
  mix: number = S.sliceMix,
  peakSpread: number = S.spread,
): WaveComponent[] {
  const wp = TAU / tp;
  const raw: { omega: number; dir: number; weight: number }[] = [];
  let energy = 0;
  const lane = strata(rng, n);
  const slice = energySlices(n, low, high, mix);
  for (let i = 0; i < n; i++) {
    // One slice of equal energy each, the component standing at that
    // slice's own centroid — jittered a quarter of the way toward either
    // edge, so two levels' seas are not the same set of frequencies.
    const lo = slice[i];
    const hi = slice[i + 1];
    const mid = slice[n + 1 + i];
    const sway = (2 * rng.next() - 1) * 0.25;
    const omega = wp * (sway >= 0 ? mid + sway * (hi - mid) : mid + sway * (mid - lo));
    const dOmega = wp * (hi - lo);
    // ...and pointing somewhere inside its own slice of the SPREAD, which
    // is the whole energy of that slice: the fan is even, every component
    // carries a real share, and the shorter ones fan wider than the peak.
    const offset = spreadAt(omega, wp, peakSpread) * spreadQuantile((lane[i] + rng.next()) / n);
    const weight = jonswap(omega, wp) * dOmega;
    energy += weight;
    raw.push({ omega, dir: travel + offset, weight });
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
