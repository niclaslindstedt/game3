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

/** THE SPEED CLASS's two factors, stated here because this file is what a
 * craft CAN do and because `propulsion.ts` reads its ceilings from here
 * (the other direction would be a cycle).
 *
 * `classPitch` is the impeller pitch the class asks for, as a multiple of
 * the spec's own: the class is quoted in the SPEED it buys and a planing
 * hull's drag grows slower than v², so the pitch behind it is the smaller
 * number (`pump.classGain`). `classTorque` is what the engine has to grow
 * by to swing it — the cube, which is what the pump's load torque goes as
 * at a given shaft speed. Both are 1 at class 1. */
export function classPitch(): number {
  return Math.pow(TUNING.pump.speedClass, 1 / TUNING.pump.classGain);
}

export function classTorque(): number {
  return classPitch() ** 3;
}

/** The jet's own speed at redline, m/s — nothing pushes the hull faster
 * through the water than the water leaving the nozzle. Under the class,
 * which is a taller impeller: the jet has to stay ahead of the hull it is
 * pushing, and `tests/craft_test.ts` holds it there at any class. */
export function jetCeiling(spec: CraftSpec): number {
  return (spec.impellerPitch * classPitch() * spec.maxRpm) / 60;
}

/** The rider's pitch authority in the air, N·m at full lean — the same
 * number `flight.ts` applies, this craft's rider included. */
export function airPitchTorque(spec: CraftSpec): number {
  return TUNING.flight.leanTorque * spec.riderAuthority;
}

/** The expected top speed, m/s: the spec's own number under the SPEED CLASS
 * (`pump.speedClass`), which is the one place the class is applied. The bot
 * reads it to know what "flat out" looks like, the open ocean's biggest wave
 * is sized off it (`ocean.ts`), and the physics is what delivers it —
 * `tests/craft_test.ts` holds the three together at whatever class is set. */
export function topSpeedOf(spec: CraftSpec): number {
  return (spec.topSpeed * TUNING.pump.speedClass) / 3.6;
}

/** The expected 0–50 km/h, s: the spec's own number under the SPEED CLASS.
 * A class scales the thrust rather than the mass, so the time to a fixed
 * speed falls as the SQUARE of it — measured over the roster, 1/k² holds
 * every class from 1 to 2 to within a few per cent. */
export function accel0to50Of(spec: CraftSpec): number {
  return spec.accel0to50 / TUNING.pump.speedClass ** 2;
}
