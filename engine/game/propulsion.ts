// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PUMP — the engine, the impeller, the jet and the nozzle it steers
// with. A personal watercraft has no propeller, no rudder and no gears: an
// axial-flow pump draws water through a flush intake under the transom
// and throws it out of a nozzle, and the nozzle swings to steer. Three
// consequences the whole handling model rests on, and all three are here:
// thrust falls as the hull speeds up (the jet gains less momentum over the
// inflow), thrust vanishes the moment the intake leaves the water, and
// with no thrust there is almost nothing to steer with.
//
// Models:
// - Waterjet MOMENTUM THEORY (Allison 1993; Bulten 2006 ch. 2): the jet
//   velocity V_j is the impeller's effective pitch times its speed, the
//   flow Q = A_nozzle·V_j, and the thrust T = ρ·Q·(V_j − V_in) with V_in the
//   inflow velocity, which is the hull's speed through the water less the
//   boundary layer (`inflowFactor`). Scaled by an overall thrust efficiency
//   for the duct and nozzle losses.
// - The PUMP LOAD: the jet's kinetic power ½·ρ·Q·V_j² over the pump's
//   hydraulic efficiency, which is ∝ rpm³ since Q and V_j are both ∝ rpm —
//   so the shaft torque is ∝ rpm². The load is what the engine revs
//   against; with the intake dry it falls to `airLoad` of that and the
//   engine runs up to the limiter.
// - The ENGINE: the spec's torque curve times the lagged throttle, less a
//   friction torque growing with rpm; the shaft integrates
//   (T_engine − T_pump)/I. The pump term is integrated IMPLICITLY — its
//   stiffness at redline (−2·T_pump/ω per rad/s) is several times the
//   step's reciprocal, and an explicit step would ring.

import { approach, clamp } from "../lib/math.ts";
import type { CraftSpec } from "./defs/craft.ts";
import { TUNING } from "./defs/tuning.ts";
import { maxNozzle, maxRpm } from "./limits.ts";

const PUMP = TUNING.pump;
const RPM_TO_RAD = (2 * Math.PI) / 60;

/** Nozzle exit area, m². */
export function nozzleArea(spec: CraftSpec): number {
  return (Math.PI * spec.nozzleDiameter * spec.nozzleDiameter) / 4;
}

/** Jet velocity at the nozzle, m/s, for an engine speed. */
export function jetVelocity(spec: CraftSpec, rpm: number): number {
  return (spec.impellerPitch * rpm) / 60;
}

/** The engine's torque at `rpm`, N·m, from the spec's curve, read linearly
 * between the points and held flat past the last. */
export function curveTorque(spec: CraftSpec, rpm: number): number {
  const pts = spec.torque;
  if (rpm <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [r1, t1] = pts[i];
    if (rpm <= r1) {
      const [r0, t0] = pts[i - 1];
      return t0 + ((t1 - t0) * (rpm - r0)) / (r1 - r0);
    }
  }
  return pts[pts.length - 1][1];
}

/** Peak torque on the curve, N·m — what the friction is quoted against. */
export function peakTorque(spec: CraftSpec): number {
  let peak = 0;
  for (const [, t] of spec.torque) if (t > peak) peak = t;
  return peak;
}

/** Net engine torque, N·m: the curve times the throttle, less friction. */
export function engineTorque(spec: CraftSpec, rpm: number, throttle: number): number {
  const friction = PUMP.friction * peakTorque(spec) * (rpm / maxRpm(spec));
  return curveTorque(spec, rpm) * throttle - friction;
}

/** Pump shaft torque at `rpm`, N·m: the jet's kinetic power over the pump
 * efficiency, over the shaft speed. ∝ rpm². */
export function pumpTorque(spec: CraftSpec, density: number, rpm: number, wet: boolean): number {
  if (rpm <= 0) return 0;
  const vj = jetVelocity(spec, rpm);
  const q = nozzleArea(spec) * vj;
  const power = (0.5 * density * q * vj * vj) / PUMP.pumpEfficiency;
  const torque = power / (rpm * RPM_TO_RAD);
  return wet ? torque : torque * PUMP.airLoad;
}

/** Thrust, N, at `rpm` with the hull doing `speedThroughWater` m/s: the
 * momentum the jet gains over the inflow. Never negative — at a closed
 * throttle at speed the intake is a drag, not a brake, and the hull's own
 * drag stands for it. Zero with the intake out of the water. */
export function thrust(
  spec: CraftSpec,
  density: number,
  rpm: number,
  speedThroughWater: number,
  wet: boolean,
): number {
  if (!wet || rpm <= 0) return 0;
  const vj = jetVelocity(spec, rpm);
  const q = nozzleArea(spec) * vj;
  const vin = Math.max(speedThroughWater, 0) * PUMP.inflowFactor;
  return Math.max(0, PUMP.thrustEfficiency * density * q * (vj - vin));
}

/** Static thrust, N — the pull at the dock with the engine at redline. */
export function staticThrust(spec: CraftSpec, density: number): number {
  return thrust(spec, density, maxRpm(spec), 0, true);
}

/** Advance the throttle lag and the shaft by one step; returns the new
 * rpm. `wet` says whether the intake is fed. */
export function stepEngine(
  spec: CraftSpec,
  density: number,
  rpm: number,
  throttleEff: number,
  throttle: number,
  wet: boolean,
  dt: number,
): { rpm: number; throttleEff: number } {
  const eff =
    throttleEff + (clamp(throttle, 0, 1) - throttleEff) * (1 - Math.exp(-dt / PUMP.throttleLag));
  const inertia = PUMP.inertia;
  const omega = rpm * RPM_TO_RAD;
  const tEngine = engineTorque(spec, rpm, eff);
  // T_pump = c·ω²: solve I(ω' − ω)/dt = T_e − c·ω'² for ω'.
  const c = omega > 1 ? pumpTorque(spec, density, rpm, wet) / (omega * omega) : 0;
  const b = omega + (dt * tEngine) / inertia;
  let next: number;
  if (c <= 0 || b <= 0) {
    next = Math.max(0, b);
  } else {
    const a = (c * dt) / inertia;
    next = (-1 + Math.sqrt(1 + 4 * a * b)) / (2 * a);
  }
  // The idle governor holds the bottom and the limiter the top.
  const nextRpm = clamp(next / RPM_TO_RAD, spec.idleRpm, maxRpm(spec));
  return { rpm: nextRpm, throttleEff: eff };
}

/** Swing the nozzle toward the steer input at the cable's rate, rad. */
export function stepNozzle(spec: CraftSpec, nozzle: number, steer: number, dt: number): number {
  const target = clamp(steer, -1, 1) * maxNozzle(spec);
  return approach(nozzle, target, PUMP.nozzleRate * maxNozzle(spec) * dt);
}
