// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR — what the hull feels from it, afloat and in flight. Afloat it
// is the drag on the hull and the rider against the wind; in the air it is
// the same drag, a flat-plate normal force with its pitch moment, the
// rider's control authority, and the rotational damping that keeps a
// flight nobody is steering from tumbling.
//
// Models:
// - Quadratic drag ½·ρ_air·C_dA·|v_rel|·v_rel against the WIND-relative
//   velocity, C_dA from the spec (hull plus rider), at the centre of
//   gravity.
// - The hull as a FLAT PLATE at angle of attack α to the airflow, with the
//   Newtonian normal-force coefficient C_N = 2·sin α·cos α (Hoerner 1965;
//   good to 45° and bounded past it) on the plate area `plateShare` of
//   length × beam, acting `cpLead` of the length ahead of the centre of
//   gravity: a nose-up hull in a headwind lifts its nose further, which is
//   the flat plate's static instability and what a rider leans against.
// - Rider authority, N·m per unit input (`TUNING.flight`) times the
//   craft's own `riderAuthority`, stated as the arcade number it is: real
//   riders do rotate a craft in the air by pulling on the bars and moving
//   their mass, and the size is chosen for what the air game needs rather
//   than measured. How much of it each rider HAS is the craft's, and it is
//   most of what separates a freestyle stand-up from a touring hull.
// - Rotational damping ∝ airspeed, an added-mass figure rather than a
//   measured one.
// - THE TUCK: the rider down behind the bars is a smaller C_dA, a lower
//   windage point and much less body to throw the craft about with
//   (`TUNING.tuck`, which carries where the 18 % comes from).
//
// What the ARCADE does with the last moment of a flight is not here: the
// hand on the rider's shoulder is `assist.ts`, which models nothing and
// says so.

import { rotate, unrotate, type Quat } from "../lib/quat.ts";
import { clamp } from "../lib/math.ts";
import type { CraftSpec } from "./defs/craft.ts";
import { TUNING } from "./defs/tuning.ts";

const F = TUNING.flight;
const K = TUNING.tuck;
const RHO = TUNING.air.density;

export type AeroResult = {
  fx: number;
  fy: number;
  fz: number;
  /** Body-frame torque, N·m. */
  tx: number;
  ty: number;
  tz: number;
};

/** The air's forces on the hull. `airShare` (0..1) is how much of the hull
 * is out of the water — the plate force, the control authority and the
 * rotational damping are the air's alone, and fade in with it.
 *
 * `crouch` (0..1) is how far down behind the bars the rider is
 * (`CraftState.crouch`): it shrinks the drag area, lowers the point the
 * air pushes on, and takes away most of what a rider can do with their
 * body in flight (`TUNING.tuck`). */
export function aeroForces(
  spec: CraftSpec,
  q: Quat,
  vx: number,
  vy: number,
  vz: number,
  windX: number,
  windZ: number,
  wx: number,
  wy: number,
  wz: number,
  steer: number,
  lean: number,
  airShare: number,
  crouch: number,
  out: AeroResult,
): void {
  const rx = vx - windX;
  const ry = vy;
  const rz = vz - windZ;
  const speed = Math.hypot(rx, ry, rz);
  // Drag on the whole, at the WINDAGE's centre: where the rider sits,
  // above the hull and a little aft — over the water's lateral centre,
  // so a crosswind pushes the hull sideways where the water resists it
  // and does not weathervane the bow downwind on every straight.
  // THE TUCK takes its share of the hole in the air, and takes the
  // rider's shoulders down with it: what is left of the windage is mostly
  // hull, so the push acts lower on the craft.
  const tuck = clamp(crouch, 0, 1);
  const cdA = spec.cdA * (1 - K.dragCut * tuck);
  const drag = 0.5 * RHO * cdA * speed;
  out.fx = -drag * rx;
  out.fy = -drag * ry;
  out.fz = -drag * rz;
  const at = {
    x: 0,
    y: F.windageY * (1 - (1 - K.windageLeft) * tuck),
    z: F.windageZ * spec.length,
  };
  const fb = unrotate(q, { x: out.fx, y: out.fy, z: out.fz });
  out.tx = at.y * fb.z - at.z * fb.y;
  out.ty = at.z * fb.x - at.x * fb.z;
  out.tz = at.x * fb.y - at.y * fb.x;
  if (airShare <= 0) return;

  // The plate: airflow in the body frame, angle of attack in the pitch
  // plane, normal force along the hull's up.
  const flow = unrotate(q, { x: rx, y: ry, z: rz });
  const alpha = Math.atan2(-flow.y, Math.max(Math.abs(flow.z), 0.1));
  const area = spec.length * spec.beam * F.plateShare;
  const cn = 2 * Math.sin(alpha) * Math.cos(alpha);
  const normal = 0.5 * RHO * speed * speed * area * cn * airShare;
  const up = rotate(q, { x: 0, y: 1, z: 0 });
  out.fx += up.x * normal;
  out.fy += up.y * normal;
  out.fz += up.z * normal;
  // Ahead of the CoG by cpLead·L: a positive normal force there pitches
  // the nose UP, which in right-handed body axes is a negative x torque.
  out.tx -= normal * F.cpLead * spec.length;

  // The rider's authority — the HOLD; the PULL that starts a flip is an
  // impulse `craft.ts` delivers. Nose-up is −x; a right roll (right side
  // down) is −z; a clockwise yaw is +y. All three are scaled by how much
  // of the craft this craft's rider actually commands (`riderAuthority`):
  // a rider standing on a stand-up throws their whole mass about, one sat
  // behind a backrest on a touring hull throws very little.
  const rider = spec.riderAuthority * airShare * (1 - (1 - K.airLeft) * tuck);
  out.tx -= clamp(lean, -1, 1) * F.leanTorque * rider;
  out.tz -= clamp(steer, -1, 1) * F.steerRoll * rider;
  out.ty += clamp(steer, -1, 1) * F.steerYaw * rider;

  // Rotational damping, rising with airspeed.
  const damp = F.rotDamp * (Math.max(speed, 5) / F.rotDampSpeed) * airShare;
  out.tx -= damp * wx;
  out.ty -= damp * wy;
  out.tz -= damp * wz;
}
