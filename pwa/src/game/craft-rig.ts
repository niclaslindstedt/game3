// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A MODELLED CRAFT POSED OFF THE ENGINE. A craft made by `make blender` is
// one skinned mesh on a rig (`scripts/blender/lib.py`): the hull on the
// `body` bone, and three DRIVERS the game turns off the craft's own state —
// each about an axis the builder wrote into the bone's extras, stated in
// the craft's BODY frame and signed so a positive reading turns it the way
// the engine means:
//
//   bars     about the steering column, by the nozzle's share of its lock
//            (`barTurn`) — the bars are cabled to the nozzle, so they turn
//            together, and the rider's hands go with them (`turnGrips`)
//   nozzle   about the hull's up by `nozzle` (a clockwise turn throws the
//            jet to the right-rear, as `craft.ts` says) and about its right
//            by `trim` (aimed up)
//   bucket   the reverse gate, swung down over the nozzle by `bucket` (none
//            on a craft with no bucket fitted)
//
// And the CLIPS the model carries, played at a moment. The asset's frame is
// the loader's business (`craft-models.ts` and the craft sheet turn it).

import * as THREE from "three";
import { maxNozzle, type CraftState } from "@engine";

import {
  BODY,
  add,
  cross,
  dot,
  normalize,
  scale,
  solveLimb,
  sub,
  type P,
  type RiderPose,
} from "./rider-pose.ts";

/** How far the bars turn at the nozzle's full lock, rad — about seventeen
 * degrees, a runabout's bars lock to lock. Handed to Blender with the
 * lines, so the model's `steer` clip turns them just as far. */
export const BAR_TURN = 0.3;

/** How far the reverse gate swings from stowed to down, rad. */
export const BUCKET_SWING = 1.1;

/** The bars' turn for a craft's state, rad, positive for a clockwise turn. */
export function barTurn(craft: CraftState): number {
  const lock = maxNozzle(craft.spec);
  return lock > 0 ? BAR_TURN * Math.max(-1, Math.min(1, craft.nozzle / lock)) : 0;
}

/** `p` turned by `angle` about the unit `axis` through `at` (Rodrigues). */
function turn(p: P, at: P, axis: P, angle: number): P {
  const v = sub(p, at);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const k = dot(axis, v) * (1 - c);
  return add(at, add(add(scale(v, c), scale(cross(axis, v), s)), scale(axis, k)));
}

/** THE HANDS GO WITH THE BARS: `pose` with both grips turned `angle` about
 * the column (`base` → `top`, body frame), each arm solved back to its
 * shoulder with the elbow bending the way it already was. The pose's own
 * arithmetic (`poseRider`) knows only the bars straight, which is all the
 * code-built craft ever draws. */
export function turnGrips(pose: RiderPose, base: P, top: P, angle: number): RiderPose {
  if (angle === 0) return pose;
  const axis = normalize(sub(top, base));
  const hands = pose.hands.map((h) => turn(h, top, axis, angle)) as [P, P];
  const bars = pose.bars.map((b) => turn(b, [0, 0, 0], axis, angle)) as [P, P];
  const elbows = [0, 1].map((i) => {
    const mid = scale(add(pose.shoulders[i], pose.hands[i]), 0.5);
    const pole = sub(pose.elbows[i], mid);
    return solveLimb(pose.shoulders[i], hands[i], BODY.upperArm, BODY.forearm, pole).mid;
  }) as [P, P];
  const wrists = [0, 1].map((i) =>
    sub(hands[i], scale(normalize(sub(hands[i], elbows[i])), BODY.fist)),
  ) as [P, P];
  return { ...pose, hands, bars, elbows, wrists };
}

export type CraftRig = {
  /** The clips the model carries, by name, with their lengths, s. */
  clips: { name: string; seconds: number }[];
  /** Whether the model has bars that turn — and so whether a rider on it
   * should have his hands turned with them. */
  steers: boolean;
  /** Back to the rest pose, every clip stopped. */
  rest(): void;
  /** Posed off the engine's state: the bars by `bars` (rad, `barTurn`'s),
   * the nozzle, the trim and the gate by the craft's own readings. */
  pose(craft: CraftState, bars: number): void;
  /** Clip `name` at `t` s. */
  play(name: string, t: number): void;
};

type Axes = { axis?: number[]; steerAxis?: number[]; trimAxis?: number[] };

/** `root` is the loaded scene; its PARENT stands in the craft's body frame
 * (the loader's turn between them), so an axis the builder stated in the
 * body frame is that parent's. */
export function rigCraft(root: THREE.Object3D, animations: THREE.AnimationClip[]): CraftRig {
  const body = root.parent ?? root;
  const rest = new Map<THREE.Object3D, THREE.Quaternion>();
  const named = new Map<string, THREE.Object3D>();
  root.traverse((o) => {
    rest.set(o, o.quaternion.clone());
    named.set(o.name, o);
  });
  const bars = named.get("bars");
  const nozzle = named.get("nozzle");
  const bucket = named.get("bucket");
  const mixer = new THREE.AnimationMixer(root);
  const axisOf = (o: THREE.Object3D, key: keyof Axes): THREE.Vector3 | null => {
    const a = (o.userData as Axes)[key];
    return a ? new THREE.Vector3(a[0], a[1], a[2]).normalize() : null;
  };
  const barAxis = bars && axisOf(bars, "axis");
  const steerAxis = nozzle && axisOf(nozzle, "steerAxis");
  const trimAxis = nozzle && axisOf(nozzle, "trimAxis");
  const gateAxis = bucket && axisOf(bucket, "axis");

  const bq = new THREE.Quaternion();
  const pq = new THREE.Quaternion();
  const q = new THREE.Quaternion();
  const w = new THREE.Vector3();
  /** Turn `o` about its own head by `angle` round `axis` (body frame). */
  function turnBy(o: THREE.Object3D, axis: THREE.Vector3, angle: number): void {
    if (!angle) return;
    body.getWorldQuaternion(bq);
    o.parent!.getWorldQuaternion(pq);
    w.copy(axis).applyQuaternion(bq).applyQuaternion(pq.invert());
    o.quaternion.premultiply(q.setFromAxisAngle(w, angle));
  }
  function reset(): void {
    mixer.stopAllAction();
    for (const [o, r] of rest) o.quaternion.copy(r);
  }

  return {
    clips: animations.map((c) => ({ name: c.name, seconds: c.duration })),
    steers: !!(bars && barAxis),
    rest: reset,
    pose(craft, turnBars) {
      reset();
      if (bars && barAxis) turnBy(bars, barAxis, turnBars);
      if (nozzle && trimAxis) turnBy(nozzle, trimAxis, craft.trim);
      if (nozzle && steerAxis) turnBy(nozzle, steerAxis, craft.nozzle);
      if (bucket && gateAxis) turnBy(bucket, gateAxis, craft.bucket * BUCKET_SWING);
      root.updateMatrixWorld(true);
    },
    play(name, t) {
      reset();
      const clip = animations.find((c) => c.name === name);
      if (!clip) return;
      const action = mixer.clipAction(clip).reset();
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true; // its last frame, not its first again
      action.play();
      mixer.setTime(t);
      root.updateMatrixWorld(true);
    },
  };
}

/** The column's two ends, body frame — off the lines the craft is built on. */
export type Column = { base: P; top: P };
