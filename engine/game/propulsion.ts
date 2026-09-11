// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PUMP — the engine, the impeller, the jet, and the three things that
// aim it: the nozzle that swings to steer, the trim that aims it up or
// down, and the bucket that drops over it to throw the flow forward. A
// personal watercraft has no propeller, no rudder and no gears: an
// axial-flow pump draws water through a flush intake under the transom
// and throws it out of a nozzle. Three consequences the whole handling
// model rests on, and all three are here: thrust falls as the hull speeds
// up (the jet gains less momentum over the inflow), thrust vanishes the
// moment the intake leaves the water, and with no thrust there is almost
// nothing to steer with — or to brake with.
//
// Models:
// - Waterjet MOMENTUM THEORY (Allison 1993; Bulten 2006 ch. 2): the jet
//   velocity V_j is the impeller's effective pitch times its speed, the
//   flow Q = A_nozzle·V_j, and the thrust T = ρ·Q·(V_j − V_in) with V_in the
//   inflow velocity, which is the hull's speed through the water less the
//   boundary layer (`inflowFactor`). Scaled by an overall thrust efficiency
//   for the duct and nozzle losses. That difference CHANGES SIGN: with the
//   throttle shut the jet is slower than the water coming in, and the duct
//   takes momentum out of the hull instead of adding it. `thrust` returns
//   the positive half and `intakeDrag` the negative one, separately,
//   because they do not act in the same place — see `intakeDrag`.
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
// - FORCED INDUCTION: a centrifugal blower geared off the crank raises
//   the delivery pressure with the square of its shaft speed, so its
//   torque contribution goes as (N/N_max)² above the onset and there is
//   nothing at all below it. The catalog's curve is already the
//   before-the-blower one (`marineCurve`), so this multiplies it.
// - THE REVERSE BUCKET: the gate catches its own deployment's share of the
//   jet and turns it forward and down, so the AXIAL force is what is left
//   going aft less what the gate sends back — `(1 − d) − d·reverse` of the
//   thrust — and it passes through zero at a neutral part way down. The
//   deflected share leaves DOWNWARD under the hull, so its reaction lifts
//   the stern — and a stern lifted behind the centre of gravity puts the
//   BOW DOWN, which is what a watercraft does under braking. The reverse
//   thrust itself acts below the centre of gravity and pushes the same
//   way, so the two agree.
//
//   WHAT THE GATE DOES NOT DO IS SWAP THE HULL'S SIDES. The nozzle is
//   UPSTREAM of it, so the gate catches a jet already thrown to one side
//   and its side walls send it forward on that same side: what the gate
//   reverses is the flow's axial sense, not which side of the transom it
//   leaves from. So the steering reaction keeps ONE sign however far down
//   the gate is, and `lateral` is the whole flow the nozzle is aiming —
//   what still goes aft plus what the gate turns forward. The inversion a
//   rider feels in reverse is not a flipped moment: it is a hull travelling
//   STERN-FIRST, where a bow swung right walks the craft left. It therefore
//   needs no model of its own, and the brake pulled with way still on
//   steers the way the bars are pointing, which is the only thing a rider
//   braking into a turn can use.
// - THE TRIM: the nozzle pivots vertically, so the thrust line leaves the
//   axis. Aimed UP, the reaction is downward at the transom, and a
//   downward force behind the centre of gravity lifts the bow.

import { approach, clamp } from "../lib/math.ts";
import type { CraftSpec } from "./defs/craft.ts";
import { TUNING } from "./defs/tuning.ts";
import { maxNozzle, maxRpm, maxTrim } from "./limits.ts";

const PUMP = TUNING.pump;
const RPM_TO_RAD = (2 * Math.PI) / 60;

/** Nozzle exit area, m². */
export function nozzleArea(spec: CraftSpec): number {
  return (Math.PI * spec.nozzleDiameter * spec.nozzleDiameter) / 4;
}

/** Jet velocity at the nozzle, m/s, for an engine speed — the impeller's
 * effective pitch times its speed. The SPEED CLASS is a taller pitch and is
 * already in the spec (`craftAtClass`), so nothing here reads it. */
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

/** What the blower is worth at `rpm`, as a multiple of the engine's own
 * torque: 1 below the onset, rising as the square of the shaft speed to
 * `1 + peak` at the limiter. 1 everywhere on a naturally aspirated craft. */
export function boostFactor(spec: CraftSpec, rpm: number): number {
  const { peak, onset } = spec.boost;
  if (peak <= 0) return 1;
  const over = clamp((rpm / maxRpm(spec) - onset) / (1 - onset), 0, 1);
  return 1 + peak * over * over;
}

/** Net engine torque, N·m: the curve times the throttle and the blower,
 * less friction. */
export function engineTorque(spec: CraftSpec, rpm: number, throttle: number): number {
  const friction = PUMP.friction * peakTorque(spec) * (rpm / maxRpm(spec));
  return curveTorque(spec, rpm) * boostFactor(spec, rpm) * throttle - friction;
}

/** Torque at the limiter with the blower in, N·m — where the spec's rated
 * power lands, and what the pump has to absorb for the two to meet. */
export function ratedTorque(spec: CraftSpec): number {
  return curveTorque(spec, maxRpm(spec)) * boostFactor(spec, maxRpm(spec));
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

/** THE INTAKE'S RAM DRAG, N — the other half of the very expression
 * `thrust` returns the positive half of, and a force rather than a
 * bookkeeping sign. The pump swallows water already travelling at the
 * hull's speed and throws it out at `V_j`: with the throttle shut and the
 * engine back at idle, `V_j` falls well under the inflow, ρ·Q·(V_j − V_in)
 * goes NEGATIVE, and the duct is taking momentum OUT of the hull. Every
 * waterjet has it, and it is the first thing a rider feels on lifting off
 * the throttle — before the hull has come off the plane, before anything
 * else in the model has had time to answer.
 *
 * It is returned on its own, as a magnitude, because it does not act where
 * the thrust does. The ram drag is the INTAKE's — under the hull, ahead of
 * the pump — so the nozzle cannot aim it and the bucket cannot turn it
 * forward: it pulls along the hull's own line whatever the bars and the
 * gate are doing. Exactly one of this and `thrust` is non-zero at a time,
 * so nothing is counted twice. */
export function intakeDrag(
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
  return Math.max(0, PUMP.thrustEfficiency * density * q * (vin - vj));
}

/** THE DEPLOYED BUCKET'S OWN DRAG, N. The gate is not only a mirror held
 * up to the jet: dropped at speed it is a plate hanging in the water
 * behind the transom, and what meets it is the HULL's speed rather than
 * the pump's flow.
 *
 * That is the half of a watercraft's brake momentum theory alone cannot
 * see, and the half that matters. Jet thrust FALLS as the hull speeds up —
 * `V_in` closes on `V_j` — so a brake made only of reversed thrust is
 * weakest exactly where a rider reaches for it, which is not how a real
 * one behaves: a modern electronic gate roughly halves a stopping distance
 * from fifty, and it does that by putting a plate in the stream and
 * burying the bow, not by pushing backwards with a jet that has almost
 * nothing left to give. Going as v², it is also nothing at all at the
 * walking pace reverse actually runs at, which is why the gate can be both
 * a brake and a reverse.
 *
 * Quoted as a drag area (C_d·A) in multiples of the nozzle's own area, so
 * a bigger pump carries a bigger gate without a second number, and scaled
 * by how far down the gate has swung and by how much of the flow that
 * craft's gate takes (`spec.bucket.reverse`) — the same measure of how
 * much of it is in the stream. A craft with no gate fitted has none of
 * this. */
export function bucketDrag(
  spec: CraftSpec,
  density: number,
  bucket: number,
  speedThroughWater: number,
  wet: boolean,
): number {
  const d = clamp(bucket, 0, 1);
  if (!wet || d <= 0 || spec.bucket.reverse <= 0) return 0;
  const v = Math.max(speedThroughWater, 0);
  const area = PUMP.bucketDragArea * nozzleArea(spec) * d * spec.bucket.reverse;
  return 0.5 * density * area * v * v;
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

/** Aim the nozzle toward the trim the rider's lean is asking for, rad —
 * leaning back trims UP. Slower than the steering nozzle: trim is a screw
 * or a motor, not a cable and a hand. Always 0 on a craft with no trim. */
export function stepTrim(spec: CraftSpec, trim: number, lean: number, dt: number): number {
  const range = maxTrim(spec);
  if (range <= 0) return 0;
  return approach(trim, clamp(lean, -1, 1) * range, PUMP.trimRate * range * dt);
}

/** Swing the bucket toward what the brake lever is asking for, 0..1 down.
 * A craft with no bucket fitted never leaves 0. */
export function stepBucket(spec: CraftSpec, bucket: number, reverse: number, dt: number): number {
  const { reverse: authority, deploy } = spec.bucket;
  if (authority <= 0 || deploy <= 0) return 0;
  return approach(bucket, clamp(reverse, 0, 1), dt / deploy);
}

/** What the gate does to the jet, given how far down it is: the share
 * still leaving THROUGH the nozzle (which is the only share the trim can
 * aim), the share of the thrust still acting ALONG the hull (negative once
 * the gate is past its neutral), the share the nozzle is still steering
 * SIDEWAYS (always positive — the gate turns the flow's axial sense, not
 * the side of the hull it leaves from), and the share thrown DOWNWARD
 * under the transom. */
export function bucketVector(
  spec: CraftSpec,
  bucket: number,
): { through: number; axial: number; lateral: number; down: number } {
  const d = clamp(bucket, 0, 1);
  const authority = spec.bucket.reverse;
  if (d <= 0 || authority <= 0) return { through: 1, axial: 1, lateral: 1, down: 0 };
  return {
    through: 1 - d,
    axial: 1 - d - d * authority,
    lateral: 1 - d + d * authority,
    down: d * authority * PUMP.bucketDown,
  };
}
