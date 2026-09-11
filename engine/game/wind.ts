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
//   keeps heading out meets the weather the twenty-metre sea out there is
//   grown in, and feels it through the same aero term as any gust.
// - An ORNSTEIN–UHLENBECK gust factor: a mean-reverting random process
//   with the turbulence intensity's stationary deviation and the gust
//   integral time scale's memory, stepped from `state.rng` so a seed
//   replays its gusts; and a second, slower one wandering the direction.
//   The Gaussian draws come from Box–Muller over the seeded stream.

import { sampleField } from "../lib/heightfield.ts";
import { clamp, TAU } from "../lib/math.ts";
import type { Rng } from "../lib/prng.ts";
import type { Bounds, Level, Wind } from "../mapgen/types.ts";
import { TUNING } from "./defs/tuning.ts";
import { createShelter, type Shelter } from "./fetch.ts";
import { oceanWind, stormAt } from "./ocean.ts";

const W = TUNING.wind;

export type WindState = {
  /** The level's mean wind: where it blows FROM (engine heading, rad) and
   * how fast at the reference height, m/s. */
  readonly meanFrom: number;
  readonly meanSpeed: number;
  /** The level's bounds — where the coast, and its shelter, stop
   * (`ocean.ts`). */
  readonly bounds: Bounds;
  /** The gust factor, a multiple of the mean (1 = the mean). */
  gust: number;
  /** How far the direction has wandered off the mean, rad. */
  veer: number;
  /** What the coast does to that mean, place by place (`fetch.ts`). */
  readonly shelter: Shelter;
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
    gust: 1,
    veer: 0,
    shelter,
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

/** Advance the gusts by `dt` seconds. Draws exactly two numbers from the
 * stream every step regardless of the wind, so a calm level and a windy
 * one consume the same randomness. */
export function stepWind(wind: WindState, rng: Rng, dt: number): void {
  wind.gust = clamp(ou(wind.gust, 1, W.gustTime, W.intensity, dt, rng), W.gustMin, W.gustMax);
  wind.veer = clamp(ou(wind.veer, 0, W.veerTime, W.veer, dt, rng), -3 * W.veer, 3 * W.veer);
}

/** Wind speed at height `y` above the sea over the plan point (`x`, `z`),
 * m/s — the height profile, the gust, the place's own shelter, and out past
 * the level's rim the storm the mean itself climbs into (`ocean.ts`). The
 * coast's own shelter opens out to nothing as the storm comes up
 * (`oceanWind`), so a rider who left by any rim meets the same weather. */
export function windSpeedAt(wind: WindState, y: number, x: number, z: number): number {
  const h = Math.max(y, W.minHeight);
  const profile = Math.log(h / W.roughness) / Math.log(W.referenceHeight / W.roughness);
  const shelter = sampleField(wind.shelter.shelter, x, z);
  const mean = oceanWind(wind.meanSpeed, shelter, stormAt(wind.bounds, x, z));
  return mean * wind.gust * profile;
}

/** The wind VELOCITY there, world frame, m/s: it blows toward the opposite
 * of `from`. */
export function windAt(
  wind: WindState,
  y: number,
  x: number,
  z: number,
): { vx: number; vz: number } {
  const speed = windSpeedAt(wind, y, x, z);
  const toward = wind.meanFrom + wind.veer + Math.PI;
  return { vx: speed * Math.sin(toward), vz: speed * Math.cos(toward) };
}
