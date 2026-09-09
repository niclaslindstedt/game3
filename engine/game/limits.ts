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

/** The rider's full lean, either way, as the input scale: 1. */
export const MAX_LEAN = 1;

/** The jet's own speed at redline, m/s — nothing pushes the hull faster
 * through the water than the water leaving the nozzle. */
export function jetCeiling(spec: CraftSpec): number {
  return (spec.impellerPitch * spec.maxRpm) / 60;
}

/** The rider's pitch authority in the air, N·m at full lean — the same
 * number `flight.ts` applies. */
export function airPitchTorque(): number {
  return TUNING.flight.leanTorque;
}

/** The expected top speed the spec documents, m/s. The bot reads it to
 * know what "flat out" looks like; the physics is what delivers it. */
export function topSpeedOf(spec: CraftSpec): number {
  return spec.topSpeed / 3.6;
}
