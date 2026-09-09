// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A unit quaternion as the craft's orientation, and the handful of
// operations the rigid body needs on it. Generic math with no game
// knowledge; it lives in the generic pool (OSS_GAME_SPEC §23.7 rule 5).
//
// CONVENTIONS, stated once. The quaternion rotates BODY axes into WORLD
// axes: body x is the craft's right, body y its up, body z its forward.
// World x is east, z north, y up. Every rotation is right-handed about the
// axis it names, which puts the game's heading — 0 along +z, growing
// CLOCKWISE seen from above — on a positive rotation about +y (it carries
// +z onto (sin h, 0, cos h), which is exactly the forward vector every other
// module uses). The other two Euler angles are quoted the way a rider
// reads them rather than the way the algebra does: `pitch` is NOSE UP
// positive, which is a NEGATIVE right-handed rotation about the right
// axis, and `roll` is RIGHT SIDE DOWN positive, a negative rotation about
// the forward axis. `fromEuler` and `toEuler` own that sign flip so nothing
// else has to remember it; body-frame angular velocities stay right-handed
// (a nose-up pitch rate is a negative `wx`).

export type Quat = { x: number; y: number; z: number; w: number };
export type Vec3 = { x: number; y: number; z: number };

export function identity(): Quat {
  return { x: 0, y: 0, z: 0, w: 1 };
}

/** Hamilton product `a ⊗ b`: rotate by `b` first, then by `a`. */
export function multiply(a: Quat, b: Quat): Quat {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

/** Renormalise in place. Integration drifts the length by a part in a
 * million per step, which after a minute at 120 Hz is a visible skew. */
export function normalize(q: Quat): Quat {
  const n = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  q.x /= n;
  q.y /= n;
  q.z /= n;
  q.w /= n;
  return q;
}

/** The rotation by `angle` radians (right-handed) about a unit axis. */
export function fromAxisAngle(ax: number, ay: number, az: number, angle: number): Quat {
  const h = angle * 0.5;
  const s = Math.sin(h);
  return { x: ax * s, y: ay * s, z: az * s, w: Math.cos(h) };
}

/** Rotate a body-frame vector into the world frame. */
export function rotate(q: Quat, v: Vec3): Vec3 {
  // v' = v + 2 w (u × v) + 2 u × (u × v), with u the vector part.
  const ux = q.x;
  const uy = q.y;
  const uz = q.z;
  const cx = uy * v.z - uz * v.y;
  const cy = uz * v.x - ux * v.z;
  const cz = ux * v.y - uy * v.x;
  const ccx = uy * cz - uz * cy;
  const ccy = uz * cx - ux * cz;
  const ccz = ux * cy - uy * cx;
  return {
    x: v.x + 2 * (q.w * cx + ccx),
    y: v.y + 2 * (q.w * cy + ccy),
    z: v.z + 2 * (q.w * cz + ccz),
  };
}

/** Rotate a world-frame vector into the body frame (the inverse rotation). */
export function unrotate(q: Quat, v: Vec3): Vec3 {
  return rotate({ x: -q.x, y: -q.y, z: -q.z, w: q.w }, v);
}

/** Advance the orientation by a BODY-frame angular velocity over `dt`:
 * `q ← q ⊗ exp(½ ω dt)`, the exact rotation for a rate held constant over
 * the step. Post-multiplied because the rate is expressed in the body's own
 * axes; a world-frame rate would pre-multiply. */
export function integrate(q: Quat, wx: number, wy: number, wz: number, dt: number): Quat {
  const mag = Math.hypot(wx, wy, wz);
  if (mag < 1e-9) return q;
  const angle = mag * dt;
  const d = fromAxisAngle(wx / mag, wy / mag, wz / mag, angle);
  return normalize(multiply(q, d));
}

/** The orientation with the given heading (rad, 0 = +z, clockwise from
 * above), pitch (nose up positive) and roll (right side down positive):
 * yaw first, then pitch about the yawed right axis, then roll about the
 * resulting forward axis. */
export function fromEuler(heading: number, pitch: number, roll: number): Quat {
  const qy = fromAxisAngle(0, 1, 0, heading);
  const qx = fromAxisAngle(1, 0, 0, -pitch);
  const qz = fromAxisAngle(0, 0, 1, -roll);
  return normalize(multiply(multiply(qy, qx), qz));
}

/** The three angles `fromEuler` was built from, read back off the rotated
 * axes. At a pitch of exactly ±90° heading and roll share an axis and the
 * split between them is arbitrary — a backflip passes through that point
 * for one step and the HUD reads a heading that swings, which is the
 * gimbal every Euler triple has and nothing downstream steers by. */
export function toEuler(q: Quat): { heading: number; pitch: number; roll: number } {
  const f = rotate(q, { x: 0, y: 0, z: 1 });
  const heading = Math.atan2(f.x, f.z);
  const pitch = Math.asin(Math.max(-1, Math.min(1, f.y)));
  // Strip the yaw and the pitch back off and what is left is a pure
  // rotation about the forward axis, whose angle is read off its vector
  // part exactly — no small-angle assumption, no sign guessed off a
  // component that passes through zero.
  const yp = fromEuler(heading, pitch, 0);
  const rest = multiply({ x: -yp.x, y: -yp.y, z: -yp.z, w: yp.w }, q);
  let roll = -2 * Math.atan2(rest.z, rest.w);
  if (roll > Math.PI) roll -= 2 * Math.PI;
  if (roll <= -Math.PI) roll += 2 * Math.PI;
  return { heading, pitch, roll };
}
