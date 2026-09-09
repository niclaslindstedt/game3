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
// - An ORNSTEIN–UHLENBECK gust factor: a mean-reverting random process
//   with the turbulence intensity's stationary deviation and the gust
//   integral time scale's memory, stepped from `state.rng` so a seed
//   replays its gusts; and a second, slower one wandering the direction.
//   The Gaussian draws come from Box–Muller over the seeded stream.

import { clamp, TAU } from "../lib/math.ts";
import type { Rng } from "../lib/prng.ts";
import type { Level, Wind } from "../mapgen/types.ts";
import { TUNING } from "./defs/tuning.ts";

const W = TUNING.wind;

export type WindState = {
  /** The level's mean wind: where it blows FROM (engine heading, rad) and
   * how fast at the reference height, m/s. */
  readonly meanFrom: number;
  readonly meanSpeed: number;
  /** The gust factor, a multiple of the mean (1 = the mean). */
  gust: number;
  /** How far the direction has wandered off the mean, rad. */
  veer: number;
};

export function createWind(level: Level, wind: Wind = level.wind): WindState {
  return { meanFrom: wind.from, meanSpeed: wind.speed, gust: 1, veer: 0 };
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

/** Wind speed at height `y` above the sea, m/s, gusts included. */
export function windSpeedAt(wind: WindState, y: number): number {
  const h = Math.max(y, W.minHeight);
  const profile = Math.log(h / W.roughness) / Math.log(W.referenceHeight / W.roughness);
  return wind.meanSpeed * wind.gust * profile;
}

/** The wind VELOCITY at height `y`, world frame, m/s: it blows toward the
 * opposite of `from`. */
export function windAt(wind: WindState, y: number): { vx: number; vz: number } {
  const speed = windSpeedAt(wind, y);
  const toward = wind.meanFrom + wind.veer + Math.PI;
  return { vx: speed * Math.sin(toward), vz: speed * Math.cos(toward) };
}
