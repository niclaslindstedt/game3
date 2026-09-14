// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR — what the hull feels from it, afloat and in flight. Afloat it
// is the drag on the hull and the rider against the wind; in the air it is
// the same drag, a flat-plate normal force with its pitch moment, the
// rider's control authority, and the rotational damping that keeps a
// flight nobody is steering from tumbling.
//
// Models:
// - Quadratic drag ½·ρ_air·C_dA·|v_rel|·v_rel against the WIND-relative
//   velocity, with the beam carrying a second, far larger area
//   (`cdASide`) by the crossflow principle — the whole slab at rest, where
//   all the air a hull meets is crossflow, and next to nothing of it at
//   speed, where the sideslip is a few degrees. The fore-and-aft push acts at the rider's
//   body; the sideways one at the centroid of the above-water side
//   profile, which stands forward of it — and forward of the wet hull's
//   lateral centre, which is what lays a drifting craft across the wind
//   instead of nose-up into it. The areas are not invented: engine off,
//   what comes out is 4.3–5.5 % of the wind speed, against the 4.24 % the
//   search-and-rescue leeway experiments measure for a watercraft with
//   one person aboard.
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
  // THE AIR DOES NOT MEET THE HULL EQUALLY FROM EVERY SIDE, and it does
  // not push equally along it. The hole a craft makes in the air head-on
  // is a beam wide by a foot of topside (`spec.cdA`); the same craft
  // BEAM-ON is a slab most of its length by most of its freeboard with a
  // bluff body's coefficient behind it (`spec.cdASide`), two or three
  // times as much. So the drag is resolved in the hull's OWN axes and each
  // one is given its own area: nose-on and vertical keep `cdA` — a craft
  // under way meets the air from ahead and nothing about a top speed or a
  // flight moves — and only the beam gets the bigger one.
  //
  // THE TUCK takes its share of the hole in the air, and takes the
  // rider's shoulders down with it: what is left of the windage is mostly
  // hull, so the push acts lower on the craft.
  const tuck = clamp(crouch, 0, 1);
  const shrink = 1 - K.dragCut * tuck;
  const flow = unrotate(q, { x: rx, y: ry, z: rz });
  const qbar = 0.5 * RHO * speed * shrink;
  const fby = -qbar * spec.cdA * flow.y;
  const fbz = -qbar * spec.cdA * flow.z;
  // The beam's EXTRA area, by the CROSSFLOW PRINCIPLE (Hoerner 1965 §3):
  // the force a slender body feels across itself goes with the square of
  // the CROSSFLOW alone, not with the whole airspeed times it. The
  // difference is the whole difference between a craft at rest and a craft
  // at speed, and both ends have to be right:
  //
  //   At rest the only airflow there is is the crossflow, so the two forms
  //   are the same number and the hull feels the whole slab — which is what
  //   makes the leeway come out at the 4–5 % of the wind that has actually
  //   been measured at sea.
  //
  //   At ninety km/h in a beam wind the sideslip is a few degrees, and the
  //   two forms differ by a factor of the airspeed over the crosswind. Take
  //   the whole slab there and a crosswind shoves a hull off its line with
  //   four hundred newtons it has no business feeling: the bot's pace
  //   across the roster moved by a fifth, in both directions, for no
  //   reason a rider would recognise. The crossflow form leaves a hull
  //   under way where it was.
  //
  // So the frontal area is carried on the beam as it always was, and only
  // what is over and above it is a slab.
  const slab = Math.max(0, spec.cdASide - spec.cdA);
  const fbx = -qbar * spec.cdA * flow.x - 0.5 * RHO * slab * shrink * Math.abs(flow.x) * flow.x;
  const world = rotate(q, { x: fbx, y: fby, z: fbz });
  out.fx = world.x;
  out.fy = world.y;
  out.fz = world.z;
  // ...AND THE TWO PUSHES STAND IN DIFFERENT PLACES. The fore-and-aft one
  // is on the centreline at the rider's body, a little aft, and turns
  // nothing; the sideways one is at the centroid of the above-water side
  // profile, `windageSideZ` of the length FORWARD of the centre of gravity
  // (the stem stands high and the transom barely clears the water). The
  // wet hull's lateral centre is right aft of both of them, so the couple
  // between the two lays a drifting craft ACROSS the wind rather than
  // nose-up into it — broadside in a light air and squaring away as it
  // freshens, which is the DIVERGENCE the leeway experiments measure.
  const high = F.windageY * (1 - (1 - K.windageLeft) * tuck);
  const aft = F.windageZ * spec.length;
  const ahead = F.windageSideZ * spec.length;
  out.tx = high * fbz - aft * fby;
  out.ty = ahead * fbx;
  out.tz = -high * fbx;
  if (airShare <= 0) return;

  // The plate: angle of attack in the pitch plane off the body-frame
  // airflow, normal force along the hull's up.
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
