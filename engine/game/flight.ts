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
// - THE ARCADE ASSIST (`landingAssist`), which is not a model of anything:
//   a predicted attitude at splashdown, and a torque toward the one the
//   hull ought to land at when the prediction says it will not. Its
//   numbers are argued against the feel (`TUNING.assist`).

import { integrate, rotate, unrotate, type Quat } from "../lib/quat.ts";
import { clamp } from "../lib/math.ts";
import type { CraftSpec } from "./defs/craft.ts";
import { TUNING } from "./defs/tuning.ts";

const F = TUNING.flight;
const A = TUNING.assist;
const RHO = TUNING.air.density;
const G = 9.81;

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
 * rotational damping are the air's alone, and fade in with it. */
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
  const drag = 0.5 * RHO * spec.cdA * speed;
  out.fx = -drag * rx;
  out.fy = -drag * ry;
  out.fz = -drag * rz;
  const at = { x: 0, y: F.windageY, z: F.windageZ * spec.length };
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
  const rider = spec.riderAuthority * airShare;
  out.tx -= clamp(lean, -1, 1) * F.leanTorque * rider;
  out.tz -= clamp(steer, -1, 1) * F.steerRoll * rider;
  out.ty += clamp(steer, -1, 1) * F.steerYaw * rider;

  // Rotational damping, rising with airspeed.
  const damp = F.rotDamp * (Math.max(speed, 5) / F.rotDampSpeed) * airShare;
  out.tx -= damp * wx;
  out.ty -= damp * wy;
  out.tz -= damp * wz;
}

/** How long, s, until the keel reaches the water, from `height` m above it
 * falling at `vy` m/s (up positive) under gravity alone. The air's drag is
 * left out on purpose: over the tenths of a second this is read across it
 * moves the answer by percent, and a closed form is what lets the attitude
 * be predicted rather than stepped. Already in the water is 0, and a climb
 * that never comes down (there is none, but the algebra allows it) is
 * `Infinity`. */
export function timeToWater(height: number, vy: number): number {
  if (height <= 0) return 0;
  const disc = vy * vy + 2 * G * height;
  if (disc <= 0) return Infinity;
  return (vy + Math.sqrt(disc)) / G;
}

/** THE ARCADE ASSIST: the hand on the rider's shoulder over the last
 * `assist.window` seconds before the water.
 *
 * The whole mechanism is one question asked every step — WHERE WILL THIS
 * HULL BE POINTING WHEN IT HITS? — and it is answered by turning the
 * craft's own attitude forward at the rate it is already turning at. When
 * the answer is a landing the rider rides away from, the assist adds
 * nothing at all: a clean jump never feels it, and a backflip that is
 * going to come round completes untouched. When the answer is a hull
 * arriving on its side or on its nose, a torque is added toward the
 * attitude it ought to land at, growing as the water closes.
 *
 * Predicting FIRST is what makes it flip-safe, and it is the reason this
 * is not simply a spring toward level. A hull three-quarters of the way
 * through a flip is a long way from level RIGHT NOW and a short way from
 * it at splashdown, so the shortest correction from the PREDICTED
 * attitude carries the rotation on round and finishes it; the same spring
 * read off the present attitude would unwind the flip into the water.
 *
 * The assist owns pitch and roll and never heading: a hand that yawed the
 * craft would be steering it, and where the rider is pointing is the
 * rider's.
 *
 * AND THE AIR IS THE RIDER'S BEFORE IT IS THE ARCADE'S. `lean` folds the
 * hand away in proportion, either way it is held: a rider working the
 * bars — winding a flip round, or stuffing the nose because that is what
 * he meant to do — gets no help and no interference, and the hand is
 * there for the rider who is not flying it. It has to be the INPUT that
 * says so rather than the rotation, because a hull half way through a
 * flip is genuinely predicted to land on its head and only the rider
 * knows that is on purpose.
 *
 * `strength` and `window` are the run's two dials (`GameState.assist`) —
 * HOW HARD the hand catches and HOW LATE it arrives — and they are two
 * because a difficulty ladder needs both: strength alone scales the
 * correction, while the window is what decides whether a flight is the
 * rider's. Over the flight bench a fifth of the stiffness reaching a
 * second and a half out saves the same landings and does it by owning most
 * of the hang, so a hard ladder shortens the window rather than only
 * softening the spring. At `strength` 0 nothing here runs and the hull
 * lands wherever the physics threw it. Torque comes back in the BODY
 * frame, N·m, and is added to the step's own. */
export function landingAssist(
  q: Quat,
  wx: number,
  wy: number,
  wz: number,
  ix: number,
  iy: number,
  iz: number,
  airTime: number,
  height: number,
  vy: number,
  lean: number,
  strength: number,
  window: number,
  out: AeroResult,
): void {
  out.fx = 0;
  out.fy = 0;
  out.fz = 0;
  out.tx = 0;
  out.ty = 0;
  out.tz = 0;
  const dial = clamp(strength, 0, 1) * (1 - clamp(Math.abs(lean), 0, 1));
  if (dial <= 0) return;
  // A CHOP HOP IS NOT A JUMP, and the line is the one the launch event is
  // already read against (`flight.minAir`). At speed in a head sea the
  // hull is clear of the water a fifth of the steps, in skips of a few
  // hundredths each, and every one of them is inside the window and hard
  // up against it — so an assist that did not ask this would be a pitch
  // damper permanently fitted to the ride, and the drumroll of a head sea
  // is the sensation this game is FOR. It waits for a real flight.
  if (airTime < F.minAir) return;
  const tti = timeToWater(height, vy);
  if (!(tti < window)) return;

  // Where the hull will be pointing when it arrives: its attitude turned
  // forward at the rate it is turning now. `integrate` is the same
  // quaternion step `craft.ts` advances the body with, taken in one jump
  // of `tti` instead of a step of `dt`.
  const arriving = integrate(q, wx, wy, wz, tti);
  // World-up seen from the arriving hull, against where a hull that is
  // landing well sees it: dead level but for `landPitch` of bow lift,
  // which in the body frame leans world-up toward the bow by that much.
  const upB = unrotate(arriving, { x: 0, y: 1, z: 0 });
  const dy = Math.cos(A.landPitch);
  const dz = Math.sin(A.landPitch);
  // The shortest turn from where it will be to where it should be: the
  // axis is the cross product upB × (0, dy, dz), the angle the one
  // between them.
  const ax = upB.y * dz - upB.z * dy;
  const ay = -upB.x * dz;
  const az = upB.x * dy;
  const sin = Math.hypot(ax, ay, az);
  if (sin < 1e-6) return;
  const angle = Math.atan2(sin, upB.y * dy + upB.z * dz);
  // Split that one turn back into the two axes the hull actually answers
  // on — the yaw component is dropped rather than applied, because where
  // the rider is pointing is the rider's — and read each against its own
  // tolerance. Signed, so each keeps the direction it has to turn.
  const pitchErr = past((angle * ax) / sin, A.pitchTolerance);
  const rollErr = past((angle * az) / sin, A.rollTolerance);
  if (pitchErr === 0 && rollErr === 0) return;

  // Past the tolerance the torque grows from zero, so nothing steps as a
  // flight crosses the line between "fine" and "caught", and it grows
  // again as the water closes — the hand tightens rather than grabbing.
  const urgency = 1 - tti / window;
  const gain = dial * urgency;
  // NEGATED, and that is the whole sign of this term: `ax`/`az` is the
  // axis that turns the VECTOR onto its target, and a body turned
  // right-handed about an axis sees a fixed world direction swing the
  // other way round it. Turning the hull the way the cross product points
  // drives world-up further from where it should be, which is a hull the
  // assist puts in upside down.
  const right = A.right * gain;
  out.tx = -pitchErr * right * ix;
  out.tz = -rollErr * right * iz;
  // ...and the rate is damped on the same schedule, so the hull arrives
  // settled instead of swinging through the attitude it was aimed at.
  // Damped flat rather than in proportion to the error, because the rate
  // IS the error here: what wrings a landing out of a flight is the plate
  // winding the nose up over the whole hang, and by the time the attitude
  // has left the band the rate is what has to be taken out of it. It
  // costs a clean flight nothing, the assist having already returned.
  const damp = A.damp * gain;
  out.tx -= damp * wx * ix;
  out.ty -= damp * wy * iy;
  out.tz -= damp * wz * iz;
}

/** How far `angle` reaches past `tolerance`, keeping its sign, and 0 while
 * it is inside — the dead band every axis of the assist is read through. */
function past(angle: number, tolerance: number): number {
  const over = Math.abs(angle) - tolerance;
  return over <= 0 ? 0 : Math.sign(angle) * over;
}
