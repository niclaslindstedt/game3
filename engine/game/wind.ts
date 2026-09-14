// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WIND — the level's mean wind, gusting. Three things read it: the sea
// is built from the MEAN (the spectrum needs a wind that has blown for
// hours, not this second's gust), the hull and the rider feel the GUST
// through the aero drag, and a hull in the air feels it as a side force
// and a pitch moment.
//
// Two models:
// - A LOG-LAW height profile (Prandtl; Stull 1988 §9): U(z) = U_ref ·
//   ln(z/z₀) / ln(z_ref/z₀), with the sea's roughness length z₀ from
//   Charnock (1955). A probe in a trough feels less wind than a rider six
//   metres up off a ramp.
// - A SHELTER field over the plan (`fetch.ts`): the mean is the wind out
//   at sea, and a level is a coast, which is the one place a wind changes
//   over a few hundred metres. It blows full strength over open water,
//   drops crossing the trees on a headland, and is a third of itself over
//   a river a kilometre inland — so it is read at the craft's POSITION as
//   well as its height. Averaged over `wind.cell` squares and read back
//   bilinearly, because a mass of air a hundred metres deep does not step
//   at a bank: it changes slowly, and so does what a rider feels.
// - ...and PAST THE LEVEL'S RIM it goes on freshening (`ocean.ts`): the
//   shelter field has run out and the coast is astern, so the mean itself
//   climbs toward `TUNING.sea.open.wind` over the storm's ramp. A rider who
//   keeps heading out meets the weather the storm out there is grown in,
//   and feels it through the same aero term as any gust.
// - ...and past where even THAT stops building, the TORNADO (`tornado.ts`),
//   which is a wind like any other here and is added to the mean as a
//   vector rather than folded into its strength: it has its own direction,
//   toward the level's start line, and is the one wind on this coast that
//   does not care which way the weather is blowing.
// - An ORNSTEIN–UHLENBECK gust factor: a mean-reverting random process
//   with the turbulence intensity's stationary deviation and the gust
//   integral time scale's memory, stepped from `state.rng` so a seed
//   replays its gusts; and a second, slower one wandering the direction.
//   The Gaussian draws come from Box–Muller over the seeded stream. It is
//   the WHOLE LEVEL's gust — the energy-containing eddies over water are
//   hundreds of metres across, and at that size one number is honest.
// - ...and under it an EDDY FIELD for the sizes that are not: a sum of
//   octaves of value noise weighted by Kolmogorov's −5/3 law (amplitude
//   as the cube root of the scale) and carried past by the mean wind,
//   which is Taylor's frozen-turbulence hypothesis (1938) — the pattern
//   is advected rather than remade, so what a fixed point reads over
//   time is a slice of it sweeping by. Two craft eight metres apart feel
//   nearly the same wind and not quite; two a hundred apart feel
//   different weather. Nothing is drawn from the stream for it: the field
//   is a pure function of place, the clock and the level's seed.

import { sampleField } from "../lib/heightfield.ts";
import { clamp, TAU } from "../lib/math.ts";
import { valueNoise } from "../lib/noise.ts";
import type { Rng } from "../lib/prng.ts";
import type { Bounds, Level, Wind } from "../mapgen/types.ts";
import { TUNING } from "./defs/tuning.ts";
import { createShelter, type Shelter } from "./fetch.ts";
import { oceanWind, stormAt } from "./ocean.ts";
import { tornadoAt, tornadoHome, tornadoInflow } from "./tornado.ts";

const W = TUNING.wind;

export type WindState = {
  /** The level's mean wind: where it blows FROM (engine heading, rad) and
   * how fast at the reference height, m/s. */
  readonly meanFrom: number;
  readonly meanSpeed: number;
  /** The level's bounds — where the coast, and its shelter, stop
   * (`ocean.ts`). */
  readonly bounds: Bounds;
  /** Where the tornado blows a rider who went too far back to: the level's
   * start line (`tornado.ts`) — and the SPEED CLASS the run is ridden at
   * (R32, `Level.pace`), which is what the tornado's edge and its blow are
   * quoted against. */
  readonly home: { readonly x: number; readonly z: number };
  readonly pace: number;
  /** The gust factor, a multiple of the mean (1 = the mean). */
  gust: number;
  /** How far the direction has wandered off the mean, rad. */
  veer: number;
  /** What the coast does to that mean, place by place (`fetch.ts`). */
  readonly shelter: Shelter;
  /** The seed the eddy field is hashed off, so a level replays the
   * turbulence it was ridden in. */
  readonly seed: number;
  /** How far the eddy field has been CARRIED, m, along each axis — the
   * mean wind's velocity integrated by `stepWind`. Taylor's hypothesis
   * says the pattern is advected rather than remade, so the field is
   * frozen and this is the only thing about it that moves. Kept here
   * rather than asked for as a clock, so `windAt` stays a function of
   * place and the wind's own state and nothing else learns to pass a
   * time it does not otherwise have. */
  driftX: number;
  driftZ: number;
};

export function createWind(
  level: Level,
  wind: Wind = level.wind,
  shelter: Shelter = createShelter(level, wind),
): WindState {
  return {
    meanFrom: wind.from,
    meanSpeed: wind.speed,
    bounds: level.bounds,
    home: tornadoHome(level),
    pace: level.pace,
    gust: 1,
    veer: 0,
    shelter,
    seed: level.seed,
    driftX: 0,
    driftZ: 0,
  };
}

/** One standard normal draw off the seeded stream (Box–Muller, one of the
 * pair kept: the other would have to be remembered across steps, and a
 * state that carries a spare draw is a state that replays differently
 * from where it was saved). */
function gaussian(rng: Rng): number {
  const u1 = Math.max(rng.next(), 1e-12);
  const u2 = rng.next();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(TAU * u2);
}

/** One Ornstein–Uhlenbeck step: dx = −(x − mean)/τ·dt + σ·√(2·dt/τ)·N. */
function ou(x: number, mean: number, tau: number, sigma: number, dt: number, rng: Rng): number {
  return x + ((mean - x) / tau) * dt + sigma * Math.sqrt((2 * dt) / tau) * gaussian(rng);
}

/** How much of the turbulence the LEVEL-WIDE process carries and how much
 * the eddy field does. Variances add for two independent processes, so
 * each one's σ is the quoted intensity times the square root of its share
 * and the pair of them still deliver `W.intensity`. */
const SQUALL = Math.sqrt(W.squallShare);
const EDDY = Math.sqrt(1 - W.squallShare);

/** Advance the gusts by `dt` seconds, and carry the eddy field downwind by
 * what the mean did in that time. Draws exactly two numbers from the
 * stream every step regardless of the wind, so a calm level and a windy
 * one consume the same randomness — and the field draws none at all. */
export function stepWind(wind: WindState, rng: Rng, dt: number): void {
  wind.gust = clamp(
    ou(wind.gust, 1, W.gustTime, W.intensity * SQUALL, dt, rng),
    W.gustMin,
    W.gustMax,
  );
  wind.veer = clamp(
    ou(wind.veer, 0, W.veerTime, W.veer * SQUALL, dt, rng),
    -3 * W.veer,
    3 * W.veer,
  );
  const toward = wind.meanFrom + Math.PI;
  wind.driftX += Math.sin(toward) * wind.meanSpeed * dt;
  wind.driftZ += Math.cos(toward) * wind.meanSpeed * dt;
}

/** THE EDDY FIELD, in standard deviations: a sum of octaves of value noise
 * over the plan, each half the size of the last and weighted by
 * Kolmogorov's inertial-subrange law — an octave's amplitude goes as the
 * cube root of its scale, so the big eddies carry the weather and the
 * small ones carry the difference between one hull and the one beside it.
 * Read at the point the field has been CARRIED past (Taylor), so a fixed
 * rider sees it sweep by at the mean wind and a rider running downwind
 * sits in one gust for longer than he should have.
 *
 * Normalised to unit variance by `eddySigma`, which is what one octave of
 * `valueNoise` is worth once centred; `tests/wind_test.ts` measures what
 * comes out and holds it to the quoted intensity, which is the only
 * reason this is exported at all. */
export function eddyAt(wind: WindState, x: number, z: number, seed: number): number {
  const px = x - wind.driftX;
  const pz = z - wind.driftZ;
  let sum = 0;
  let norm = 0;
  for (let k = 0; k < W.eddyOctaves; k++) {
    const octave = 1 / 2 ** k;
    const weight = octave ** W.eddyExponent;
    sum += weight * (valueNoise(px, pz, W.eddyScale * octave, seed + k) - 0.5);
    norm += weight * weight;
  }
  return sum / (W.eddySigma * Math.sqrt(norm));
}

/** The two fields are read off the level's seed a stride apart, so the
 * gust's octaves and the veer's never share a lattice. */
const GUST_FIELD = 0;
const VEER_FIELD = 64;

const inflow = new Float64Array(2);

/** The wind VELOCITY at height `y` over the plan point (`x`, `z`), world
 * frame, m/s — the height profile, the gust, the place's own shelter, out
 * past the level's rim the storm the mean itself climbs into (`ocean.ts`),
 * and past the far edge of that the tornado's inflow (`tornado.ts`). The
 * coast's own shelter opens out to nothing as the storm comes up
 * (`oceanWind`), so a rider who left by any rim meets the same weather.
 *
 * The level's own wind blows toward the opposite of `from`; the tornado
 * blows toward the start line and is added to it as a VECTOR, because it is
 * a second wind rather than more of the first one. Both are read through the
 * same height profile and the same gust — a tornado is the gustiest thing on
 * this coast, and a hull thrown twenty-five metres up is in faster air than
 * one on the water. */
export function windAt(
  wind: WindState,
  y: number,
  x: number,
  z: number,
): { vx: number; vz: number } {
  const h = Math.max(y, W.minHeight);
  const profile = Math.log(h / W.roughness) / Math.log(W.referenceHeight / W.roughness);
  const shelter = sampleField(wind.shelter.shelter, x, z);
  const mean = oceanWind(wind.meanSpeed, shelter, stormAt(wind.bounds, x, z));
  // THE PLACE'S OWN SHARE OF THE TURBULENCE, on top of the level's: the
  // eddies small enough that the hull beside you is not in the same one.
  // Both are multiples of the quoted σ, and the product of the level's
  // gust and the place's is clamped once — a point cannot be handed a
  // calm or a hurricane by the two of them agreeing.
  const gust = clamp(
    wind.gust * (1 + W.intensity * EDDY * eddyAt(wind, x, z, wind.seed + GUST_FIELD)),
    W.gustMin,
    W.gustMax,
  );
  const veer = wind.veer + W.veer * EDDY * eddyAt(wind, x, z, wind.seed + VEER_FIELD);
  const toward = wind.meanFrom + veer + Math.PI;
  // The level's own wind first and on its own terms — `mean · gust ·
  // profile`, in that order — so that everywhere the tornado is not, which
  // is everywhere a run is ridden, this returns the same bits it returned
  // before there was one. Folding the two winds into a common scale factor
  // reorders the multiply, and float multiplication is not associative: the
  // last bit it costs is a different sim digest on every seed.
  const speed = mean * gust * profile;
  const scale = gust * profile;
  tornadoInflow(tornadoAt(wind.bounds, wind.pace, x, z), wind.pace, wind.home, x, z, inflow);
  return {
    vx: speed * Math.sin(toward) + inflow[0] * scale,
    vz: speed * Math.cos(toward) + inflow[1] * scale,
  };
}

/** How hard it is blowing there, m/s — the magnitude of {@link windAt}, for
 * a vane, a lab transect or anything else that wants the weather without
 * caring where it is going. */
export function windSpeedAt(wind: WindState, y: number, x: number, z: number): number {
  const v = windAt(wind, y, x, z);
  return Math.hypot(v.vx, v.vz);
}
