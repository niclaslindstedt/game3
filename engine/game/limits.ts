// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A CRAFT CAN DO — the model's own ceilings, stated once. The physics
// enforces them and the bot plans around them, and a bot planning off a
// number that only resembles the one the pump will apply is not a rider
// misjudging a turn, it is a rider in a different craft. Nothing here has
// state and nothing steps anything: they are questions about a SPEC.

import type { CraftSpec } from "./defs/craft.ts";
import { TUNING } from "./defs/tuning.ts";

/** The redline, rpm — the limiter holds the engine here wet or dry. */
export function maxRpm(spec: CraftSpec): number {
  return spec.maxRpm;
}

/** Full nozzle deflection, rad, either way. */
export function maxNozzle(spec: CraftSpec): number {
  return spec.nozzleAngle;
}

/** How far the nozzle may be trimmed above or below the hull's axis, rad;
 * 0 on a craft with no trim system. */
export function maxTrim(spec: CraftSpec): number {
  return spec.trimRange;
}

/** The share of the jet's thrust the bucket can send back the other way
 * with the gate fully down; 0 on a craft with no bucket, which therefore
 * has no brake and no reverse. */
export function maxReverse(spec: CraftSpec): number {
  return spec.bucket.reverse;
}

/** The rider's full lean, either way, as the input scale: 1. */
export const MAX_LEAN = 1;

/** The jet's own speed at redline, m/s — nothing pushes the hull faster
 * through the water than the water leaving the nozzle. The SPEED CLASS is
 * already in the spec's own pitch (`craftAtClass`), so the jet stays ahead
 * of the hull it is pushing at any class; `tests/craft_test.ts` holds it
 * there. */
export function jetCeiling(spec: CraftSpec): number {
  return (spec.impellerPitch * spec.maxRpm) / 60;
}

/** The rider's pitch authority in the air, N·m at full lean — the same
 * number `flight.ts` applies, this craft's rider included. */
export function airPitchTorque(spec: CraftSpec): number {
  return TUNING.flight.leanTorque * spec.riderAuthority;
}

/** The expected top speed the spec documents, m/s — the SPEED CLASS is
 * already in it (`craftAtClass`). The bot reads it to know what "flat out"
 * looks like, the open ocean's biggest wave is sized off it (`ocean.ts`),
 * the generator paces its gates by it (`mapgen/rules.ts`), and the physics
 * is what delivers it — `tests/craft_test.ts` holds them together. */
export function topSpeedOf(spec: CraftSpec): number {
  return spec.topSpeed / 3.6;
}

/** HOW MUCH WATER A CRAFT NEEDS TO GET UP TO SPEED — the distance, m, from a
 * standing start to `share` of its own top speed on flat water.
 *
 * A closed form rather than a scripted run, because it is asked at BUILD
 * time: R35 spaces a tricks run's ramps by it, and a level that had to ride
 * a hull for two hundred metres to find out where to put the next lip would
 * be a level nobody could stand up on a phone.
 *
 * The model is the hull's own: thrust flat and drag quadratic in speed, so
 * `dv/dt = a0 (1 − v²/v_max²)`, which integrates in distance to
 * `x = (v_max² / 2a0) · ln(1 / (1 − share²))`. The initial acceleration `a0`
 * is read back out of the spec's own `accel0to50` under the same model, so
 * the answer moves when a craft is retuned and there is no third number to
 * keep in step. The SPEED CLASS is already in the spec (`craftAtClass`).
 *
 * It is an UNDERESTIMATE in a sea and deliberately so — measured against a
 * scripted full-throttle run on flat water it is within about a tenth
 * (marlin 153 m against 154, dart 75 m against 69), and in a 6 m/s sea the
 * same run takes half again as long, because a hull climbing a head sea is
 * spending thrust on the wave rather than on the speedo. What that costs a
 * tricks run is a rider arriving at the odd lip at ninety-odd per cent
 * instead of ninety-five, which is a jump; what the honest sea figure would
 * cost is half the ramps on the shore.
 */
export function runUpTo(spec: CraftSpec, share: number): number {
  const vMax = topSpeedOf(spec);
  const f = Math.min(Math.max(share, 0), 0.999);
  // `a0` from the spec's documented standing-start time to 50 km/h, under
  // the same model: t = (v_max / 2a0) · ln((1 + f50) / (1 − f50)).
  const f50 = Math.min(50 / 3.6 / vMax, 0.999);
  const a0 = (vMax / (2 * spec.accel0to50)) * Math.log((1 + f50) / (1 - f50));
  return ((vMax * vMax) / (2 * a0)) * Math.log(1 / (1 - f * f));
}
