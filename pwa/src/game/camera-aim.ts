// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A RIG'S POSE, PUT ON A THREE.JS CAMERA — where the lens stands, what it
// looks at, and which way is up when the shot is banked.
//
// It is here rather than in `renderer.ts` because it is the one piece of
// that frame which is not drawing: `camera.ts` decides where the lens
// SHOULD be and this puts it there, and between them is a coordinate
// convention with a trap in it. It cannot live in `camera-lens.ts` beside
// the fov arithmetic either — that module is deliberately three-free so the
// rigs can read it, and this is nothing but three.
//
// THE TRAP IS THE ROLL. `lookAt` builds the lens's basis from the camera's
// `up`, so banking a shot is not a rotation applied after the fact — it is a
// different `up` handed in before. Rolling the world-up directly is what
// looks obvious and is wrong at the poles of the shot: a lens looking
// steeply down has a line of sight nearly parallel to world up, and the
// cross product that squares them collapses. So the basis is built off the
// LINE OF SIGHT first — forward, then the right that is level with the
// world, then the up that is square to both — and the bank is taken in that
// basis, where it is well conditioned whatever the lens is pointed at.

import * as THREE from "three";

/** Scratch for the basis, so a frame allocates nothing to aim its lens. */
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const upVec = new THREE.Vector3();

/** Stand the camera at `at`, look at `aim`, and bank it by `roll` radians —
 * right side down for a positive roll, the same sign the hull rolls by. */
export function aimCamera(
  camera: THREE.Camera,
  at: { x: number; y: number; z: number },
  aim: THREE.Vector3,
  roll: number,
): void {
  camera.position.set(at.x, at.y, at.z);
  if (roll !== 0) {
    forward.copy(aim).sub(camera.position).normalize();
    right.crossVectors(forward, upVec.set(0, 1, 0)).normalize();
    upVec.crossVectors(right, forward).normalize();
    camera.up.copy(upVec).multiplyScalar(Math.cos(roll)).addScaledVector(right, Math.sin(roll));
  } else camera.up.set(0, 1, 0);
  camera.lookAt(aim);
}
